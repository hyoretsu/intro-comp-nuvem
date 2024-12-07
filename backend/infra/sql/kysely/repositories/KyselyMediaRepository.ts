import {
	Category,
	type CreateMediaDatabaseDTO,
	type CreateVideoChannelDTO,
	type LiteraryWorkChapter,
	type Media,
	type MediaFilters,
	type MediaRepository,
} from "@enki/domain";
import { type Kysely, type SelectQueryBuilder, sql } from "kysely";
import type { KeyValue } from "..";
import type { VideoChannelSelectable, VideoChannelUpdateable, VideoSelectable } from "../entities";
import type { DB } from "../types";

export class KyselyMediaRepository implements MediaRepository {
	private readonly findQueries: Record<Category, SelectQueryBuilder<DB, any, any>>;

	constructor(private readonly db: Kysely<DB>) {
		// @ts-expect-error
		this.findQueries = {
			[Category.LITERARY_WORK]: this.db
				.selectFrom("LiteraryWork as media")
				.select(["media.id", "media.title", "media.synopsis", "media.type", "media.tags", "media.ongoing"]),
			[Category.MOVIE]: this.db
				.selectFrom("Movie as media")
				.select(["media.id", "media.title", "media.duration", "media.releaseDate"]),
			[Category.VIDEO]: this.db
				.selectFrom("Video as media")
				.select([
					"media.id",
					"media.title",
					"media.link",
					"media.duration",
					"media.channelId",
					"media.playlistId",
				]),
			[Category.VIDEO_GAME]: this.db.selectFrom("VideoGame as media").select(["media.id", "media.title"]),
		};
	}

	public async create(data: CreateMediaDatabaseDTO): Promise<{ id: string }> {
		switch (data.category) {
			case Category.CHAPTER: {
				const { category, ...actualData } = data;

				return this.db
					.insertInto("LiteraryWorkChapter")
					.values(actualData)
					.returning("id")
					.executeTakeFirstOrThrow();
			}
			case Category.LITERARY_WORK: {
				const { category, ...actualData } = data;

				return this.db
					.insertInto("LiteraryWork")
					.values(actualData)
					.returning("id")
					.executeTakeFirstOrThrow();
			}
			case Category.MOVIE: {
				const { category, ...actualData } = data;

				return this.db.insertInto("Movie").values(actualData).returning("id").executeTakeFirstOrThrow();
			}
			case Category.VIDEO: {
				const { category, ...actualData } = data;

				return this.db.insertInto("Video").values(actualData).returning("id").executeTakeFirstOrThrow();
			}
			case Category.VIDEO_GAME: {
				const { category, ...actualData } = data;

				return this.db.insertInto("VideoGame").values(actualData).returning("id").executeTakeFirstOrThrow();
			}
			default:
				throw new Error("Media unsupported.");
		}
	}

	public async createChapters(workId: string, chapters: number): Promise<void> {
		await this.db.executeQuery(sql`SELECT create_chapters(${workId},${chapters})`.compile(this.db));
	}

	public async createVideoChannel(data: CreateVideoChannelDTO): Promise<VideoChannelSelectable> {
		const channel = await this.db
			.insertInto("VideoChannel")
			.values(data)
			.returningAll()
			.executeTakeFirstOrThrow();

		return channel;
	}

	public async find(shallow: boolean, category?: Category, filters?: MediaFilters): Promise<Media[]> {
		let query: SelectQueryBuilder<DB, any, any>;
		if (shallow) {
			query = this.db
				.selectFrom("EntertainmentMedia as media")
				.select(["media.id", "media.title", "media.category", "media.releaseDate"]);

			if (category) {
				query = query.where("category", "=", category);
			}
		} else {
			if (!category) {
				throw new Error("Either do a shallow search or send a category.");
			}

			query = this.findQueries[category]?.orderBy("media.createdAt desc");

			if (!query) {
				throw new Error("Media unsupported.");
			}

			if (category === Category.LITERARY_WORK) {
				query = query
					.leftJoin("LiteraryWorkChapter as lwc", "lwc.sourceId", "media.id")
					.select(eb =>
						eb.fn
							.jsonAgg(
								sql<Record<string, any>>`
									jsonb_build_object(
										'id', lwc."id",
										'title', lwc."title",
										'number', lwc."number",
										'pages', lwc."pages",
										'releaseDate', lwc."releaseDate"
									)
								`,
							)
							.as("chapters"),
					)
					.groupBy([
						"media.id",
						"media.title",
						"media.synopsis",
						"media.type",
						"media.tags",
						"media.ongoing",
					]);
			}
		}

		if (filters?.mediaId) {
			// @ts-expect-error: This is correct though?
			query = query.where("media.id", "in", filters.mediaId);
		}

		if (filters?.title) {
			query = query.where(eb =>
				eb.exists(
					eb
						.selectFrom(sql<KeyValue>`jsonb_each_text(media.title)`.as("kv"))
						.where("kv.value", "ilike", `%${filters.title}%`),
				),
			);
		}

		const media = (await query.execute()) as Media[];

		return media;
	}

	public async findById(category: Category, id: string): Promise<Record<string, any> | undefined> {
		let query: any;

		switch (category) {
			case Category.CHAPTER:
				query = this.db.selectFrom("LiteraryWork");
				break;
			case Category.LITERARY_WORK:
				query = this.db.selectFrom("LiteraryWork");
				break;
			case Category.MOVIE:
				query = this.db.selectFrom("Movie");
				break;
			case Category.VIDEO:
				query = this.db.selectFrom("Video");
				break;
			case Category.VIDEO_GAME:
				query = this.db.selectFrom("VideoGame");
				break;
			default:
				throw new Error("Media unsupported.");
		}

		query = query.where("id", "=", id).selectAll().executeTakeFirst();
		const media = await query;

		return media;
	}

	public async findChannelByExternalId(externalId: string): Promise<VideoChannelSelectable | undefined> {
		const channel = await this.db
			.selectFrom("VideoChannel")
			.where("externalId", "=", externalId)
			.selectAll()
			.executeTakeFirst();

		return channel;
	}

	public async findChannelByUrl(url: string): Promise<VideoChannelSelectable | undefined> {
		const channel = await this.db
			.selectFrom("VideoChannel")
			.where("link", "=", url)
			.selectAll()
			.executeTakeFirst();

		return channel;
	}

	public async findChapter(sourceId: string, number: number): Promise<LiteraryWorkChapter | undefined> {
		const chapter = await this.db
			.selectFrom("LiteraryWorkChapter")
			.where(eb =>
				eb.and({
					number,
					sourceId,
				}),
			)
			.selectAll()
			.executeTakeFirst();

		return chapter;
	}

	public async findVideoByUrl(url: string): Promise<VideoSelectable | undefined> {
		const video = await this.db.selectFrom("Video").where("link", "=", url).selectAll().executeTakeFirst();

		return video;
	}

	public async updateChannel(id: string, data: VideoChannelUpdateable): Promise<void> {
		await this.db.updateTable("VideoChannel").set(data).where("id", "=", id).execute();
	}
}
