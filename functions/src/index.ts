import {onRequest} from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";
import axios from "axios";
import express from "express";
import {Request, Response} from "express";
import cors from "cors";

// Expressアプリを初期化
const app = express();
app.use(cors({origin: true}));

// 環境変数を取得
const SPOTIFY_CLIENT_ID = process.env.SPOTIFY_CLIENT_ID;
const SPOTIFY_CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET;
const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY;

// Spotifyから受け取るトラックの型定義
interface SpotifyTrack {
  artists: { name: string }[];
  name: string;
  album: { images: { url: string }[] };
  id: string;
}

// 楽曲検索のエンドポイント
app.get("/", async (request: Request, response: Response) => {
  // 環境変数のチェック
  if (!SPOTIFY_CLIENT_ID || !SPOTIFY_CLIENT_SECRET || !YOUTUBE_API_KEY) {
    logger.error("サーバーの環境変数が正しく設定されていないため、リクエストを処理できません。");
    return response.status(500).send("サーバー設定エラー");
  }

  logger.info("楽曲検索リクエストを受け取りました", {structuredData: true});

  // クエリパラメータのチェック
  const songName = request.query.q;
  if (!songName || typeof songName !== "string") {
    logger.error("曲名が指定されていません。");
    return response.status(400).send("クエリパラメータ 'q' で曲名を指定してください。");
  }

  try {
    // --- 1. Spotify APIでアクセストークンを取得 ---
    const token = Buffer.from(`${SPOTIFY_CLIENT_ID}:${SPOTIFY_CLIENT_SECRET}`)
      .toString("base64");

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

    // --- 2. Spotify APIで楽曲を検索 ---
    const spotifyResponse = await axios.get(
      "https://api.spotify.com/v1/search",
      {
        headers: {"Authorization": `Bearer ${accessToken}`},
        params: {q: songName, type: "track", limit: 10, market: "JP"},
      },
    );

    const spotifyTracks: SpotifyTrack[] = spotifyResponse.data.tracks.items;

    if (!spotifyTracks || spotifyTracks.length === 0) {
      return response.status(200).send({tracks: {items: []}});
    }

    // --- 3. YouTube APIで各楽曲の「埋め込み可能な」動画を検索 ---
    const searchPromises = spotifyTracks.map(async (track) => {
      const artist = track.artists[0]?.name || "";
      const title = track.name;
      const youtubeQuery = `${artist} ${title} official audio`;

      try {
        // ★★★ 修正点: 複数の候補を取得し、埋め込み可能かチェックするロジックに変更 ★★★

        // 手順A: まず動画候補を5つ検索する
        const searchResponse = await axios.get(
          "https://www.googleapis.com/youtube/v3/search",
          {
            params: {
              part: "snippet",
              q: youtubeQuery,
              key: YOUTUBE_API_KEY,
              type: "video",
              maxResults: 5, // 候補を5件に増やす
            },
          },
        );

        if (!searchResponse.data.items || searchResponse.data.items.length === 0) {
          return {...track, youtubeVideoId: null}; // 候補がなければnullを返す
        }

        // 手順B: 候補の動画IDリストを取得し、詳細情報をリクエストする
        const videoIds = searchResponse.data.items
          .map((item: any) => item.id.videoId)
          .filter(Boolean)
          .join(",");

        if (!videoIds) {
          return {...track, youtubeVideoId: null};
        }

        const detailsResponse = await axios.get(
          "https://www.googleapis.com/youtube/v3/videos",
          {
            params: {
              part: "status", // 埋め込み可能かどうかの情報だけを取得
              id: videoIds,
              key: YOUTUBE_API_KEY,
            },
          },
        );

        // 手順C: 詳細情報の中から、最初に見つかった「埋め込み可能」な動画を探す
        const embeddableVideo = detailsResponse.data.items.find(
          (item: any) => item.status.embeddable === true,
        );
        
        // 埋め込み可能な動画IDを返す (見つからなければnull)
        const finalVideoId = embeddableVideo ? embeddableVideo.id : null;
        return {...track, youtubeVideoId: finalVideoId};

      } catch (ytError: any) {
        logger.error(`YouTube検索に失敗しました: ${youtubeQuery}`, ytError.response?.data || ytError.message);
        return {...track, youtubeVideoId: null};
      }
    });

    const tracksWithYoutube = await Promise.all(searchPromises);

    // --- 4. 最終的な結果をクライアントに返す ---
    logger.info(`「${songName}」の検索が成功しました。`);
    return response.status(200).send({tracks: {items: tracksWithYoutube}});

  } catch (error: any) {
    if (error.response) {
      logger.error("APIの呼び出しでエラーが発生しました。", {
        status: error.response.status,
        data: error.response.data,
      });
    } else {
      logger.error("APIの呼び出しで予期せぬエラーが発生しました。", error);
    }
    return response.status(500).send("サーバー内部でエラーが発生しました。");
  }
});

// Firebase FunctionsとしてこのExpressアプリをエクスポート
export const searchsongs = onRequest(app);

