import {onRequest} from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";
import axios from "axios";
import {defineString} from "firebase-functions/params";

// Spotifyの秘密情報を定義
const SPOTIFY_ID = defineString("SPOTIFY_ID");
const SPOTIFY_SECRET = defineString("SPOTIFY_SECRET");
// ★ 1. YouTubeのAPIキーを新しい秘密情報として定義します
const YOUTUBE_API_KEY = defineString("YOUTUBE_API_KEY");

// ★ no-explicit-any 警告を解決するための型定義
interface SpotifyTrack {
  artists: { name: string }[];
  name: string;
}

export const searchsongs = onRequest(
  {cors: true},
  async (request, response) => {
    logger.info("楽曲検索リクエストを受け取りました", {structuredData: true});

    const songName = request.query.q;
    if (!songName || typeof songName !== "string") {
      logger.error("曲名が指定されていません。");
      response.status(400).send("クエリパラメータ 'q' で曲名を指定してください。");
      return;
    }

    try {
      // --- Spotifyでの検索処理 (ここはほぼ変更なし) ---
      const spotifyId = SPOTIFY_ID.value();
      const spotifySecret = SPOTIFY_SECRET.value();
      const token = Buffer.from(`${spotifyId}:${spotifySecret}`)
        .toString("base64");

      // ★ max-len エラーを解決するために改行
      const tokenResponse = await axios.post(
        "https://accounts.spotify.com/api/token",
        "grant_type=client_credentials",
        {
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            "Authorization": `Basic ${token}`,
          },
        },
      );
      const accessToken = tokenResponse.data.access_token;

      const spotifyResponse = await axios.get(
        "https://api.spotify.com/v1/search",
        {
          headers: {"Authorization": `Bearer ${accessToken}`},
          params: {q: songName, type: "track", limit: 10, market: "JP"},
        },
      );

      const spotifyTracks = spotifyResponse.data.tracks.items;

      if (!spotifyTracks || spotifyTracks.length === 0) {
        // Spotifyで何も見つからなかった場合は、空の結果を返す
        response.status(200).send({tracks: {items: []}});
        return;
      }

      // ★ 2. ここからがYouTube検索の追加処理 ---
      // Spotifyで見つかった各曲について、YouTube検索を並行して行う
      // ★ no-explicit-any 警告を解決するために型を指定
      const searchPromises = spotifyTracks.map(async (track: SpotifyTrack) => {
        const artist = track.artists[0]?.name || "";
        const title = track.name;
        // より公式音源を見つけやすくするための検索クエリ
        const youtubeQuery = `${artist} ${title} official audio`;

        try {
          const youtubeResponse = await axios.get(
            "https://www.googleapis.com/youtube/v3/search",
            {
              params: {
                part: "snippet",
                q: youtubeQuery,
                key: YOUTUBE_API_KEY.value(),
                type: "video",
                maxResults: 1, // 最も関連性の高い1件だけで十分
              },
            },
          );

          const videoId = youtubeResponse.data.items[0]?.id?.videoId || null;

          // 元のSpotifyのトラック情報に、youtubeVideoIdを追加して返す
          return {...track, youtubeVideoId: videoId};
        } catch (ytError) {
          logger.error(`Youtube failed for: ${youtubeQuery}`, ytError);
          // もしYouTube検索が失敗しても、全体を止めずにvideoIdなしで返す
          return {...track, youtubeVideoId: null};
        }
      });

      // すべてのYouTube検索が完了するのを待つ
      const tracksWithYoutube = await Promise.all(searchPromises);

      // ★ 3. YouTubeの動画IDが追加された最終的なデータをアプリに返す
      logger.info(`「${songName}」の検索が成功しました。`);
      response.status(200).send({tracks: {items: tracksWithYoutube}});
    } catch (error) {
      logger.error("APIの呼び出しでエラーが発生しました。", error);
      response.status(500).send("サーバー内部でエラーが発生しました。");
    }
  },
);
