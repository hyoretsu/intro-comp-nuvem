import { Category, type CreateMediaDTO, HttpException, type MediaRepository } from "@enki/domain";
import { StatusCodes } from "http-status-codes";
import { parse, toSeconds } from "iso8601-duration";
import { randomUUID } from "node:crypto";
import { youtubeClient } from "~/clients";
import { getShortUrl } from "~/utils";

export class CreateMedia {
	constructor(private readonly mediaRepository: MediaRepository) {}

	public async execute({ noCheck, ...data }: CreateMediaDTO): Promise<string> {
		let mediaId: string;

		if (data.image && data.image instanceof File) {
			const filePath = `${randomUUID()}.jpg`;

			await Bun.s3.write(filePath, data.image);

			data.image = `https://${process.env.S3_BUCKET}.s3.${process.env.AWS_REGION}.amazonaws.com/${filePath}`;
		}

		switch (data.category) {
			case Category.CHAPTER: {
				const { number, sourceId, ...rest } = data;

				if (!noCheck) {
					const existingChapter = await this.mediaRepository.findChapter(sourceId, number);

					if (existingChapter) {
						throw new HttpException("This chapter already exists.", StatusCodes.CONFLICT);
					}
				}

				const { id } = await this.mediaRepository.create({
					...rest,
					sourceId,
					number,
				});

				mediaId = id;
				break;
			}
			case Category.LITERARY_WORK: {
				const { currentChapters, ...rest } = data;

				// @ts-expect-error
				const { id } = await this.mediaRepository.create(rest);

				if (currentChapters) {
					await this.mediaRepository.createChapters(id, currentChapters);
				}

				mediaId = id;
				break;
			}
			case Category.MOVIE: {
				const { duration, ...rest } = data;

				const { id } = await this.mediaRepository.create({
					...rest,
					duration: duration ? toSeconds(parse(duration)) : undefined,
				});

				mediaId = id;
				break;
			}
			case Category.VIDEO: {
				const shortUrl = getShortUrl(data.link);

				if (!noCheck) {
					const existingVideo = await this.mediaRepository.findVideoByUrl(shortUrl);

					if (existingVideo) {
						throw new HttpException("A video with this link already exists.", StatusCodes.CONFLICT);
					}
				}

				let {
					contentDetails: { duration },
					snippet: { channelId, publishedAt, title },
				} = (
					await youtubeClient.videos.list({
						id: [shortUrl.split("/").at(-1)!],
						part: ["contentDetails", "snippet"],
					})
				).data.items[0];

				let existingChannel = await this.mediaRepository.findChannelByExternalId(channelId);
				if (!existingChannel) {
					const {
						snippet: { customUrl: channelUrl, title: channelTitle },
					} = (
						await youtubeClient.channels.list({
							id: [channelId],
							part: ["snippet"],
						})
					).data.items[0];

					const link = `https://youtube.com/${channelUrl}`;

					existingChannel = await this.mediaRepository.findChannelByUrl(link);
					if (!existingChannel) {
						const channel = await this.mediaRepository.createVideoChannel({
							externalId: channelId,
							link,
							name: channelTitle,
						});

						channelId = channel.id;
					} else {
						await this.mediaRepository.updateChannel(existingChannel.id, { externalId: channelId });

						channelId = existingChannel.id;
					}
				} else {
					channelId = existingChannel.id;
				}

				const { id } = await this.mediaRepository.create({
					category: Category.VIDEO,
					channelId: channelId,
					duration: String(toSeconds(parse(duration))),
					// @ts-ignore
					image: data.image,
					link: shortUrl,
					releaseDate: new Date(publishedAt),
					title: {
						default: [title],
					},
				});

				mediaId = id;
				break;
			}
			case Category.VIDEO_GAME: {
				const { id } = await this.mediaRepository.create(data);

				mediaId = id;
				break;
			}
			default:
				throw new HttpException("Media unsupported.", StatusCodes.BAD_REQUEST);
		}

		return mediaId;
	}
}
