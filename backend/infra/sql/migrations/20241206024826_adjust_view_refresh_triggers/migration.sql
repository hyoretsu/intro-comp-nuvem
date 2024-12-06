DROP TRIGGER literary_work_refresh ON "LiteraryWork";
DROP TRIGGER movie_refresh ON "Movie";
DROP TRIGGER video_refresh ON "Video";
DROP TRIGGER video_game_refresh ON "VideoGame";

CREATE TRIGGER literary_work_refresh
AFTER DELETE OR INSERT OR UPDATE ON "LiteraryWork"
EXECUTE FUNCTION update_entertainment_media();

CREATE TRIGGER movie_refresh
AFTER DELETE OR INSERT OR UPDATE ON "Movie"
EXECUTE FUNCTION update_entertainment_media();

CREATE TRIGGER video_refresh
AFTER DELETE OR INSERT OR UPDATE ON "Video"
EXECUTE FUNCTION update_entertainment_media();

CREATE TRIGGER video_game_refresh
AFTER DELETE OR INSERT OR UPDATE ON "VideoGame"
EXECUTE FUNCTION update_entertainment_media();
