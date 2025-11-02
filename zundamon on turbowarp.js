// Turbowarp Zundamon (Web API) Extension
(function (Scratch) {
  'use strict';

  // WEB版VOICEVOX (tts.quest) の APIエンドポイント
  const API_URL = 'https://api.tts.quest/v3/voicevox/synthesis';

  class VoicevoxWebExtension {
    constructor() {
      // デフォルトの話者IDを「ずんだもん（ノーマル）」の '3' に設定
      this.speakerId = 3;
      this.audioPlayer = null; // 音声再生用のAudioオブジェクト
      this.lastSynthesisTime = 0; // 連続リクエスト防止用
    }

    getInfo() {
      return {
        id: 'voicevoxweb',
        name: 'ずんだもん TTS (Web)',
        color1: '#81c784', // ずんだ餅の色
        color2: '#a5d6a7',
        blocks: [
          {
            opcode: 'speakAndWait',
            blockType: Scratch.BlockType.COMMAND,
            text: '[TEXT] としゃべって待つ',
            arguments: {
              TEXT: {
                type: Scratch.ArgumentType.STRING,
                defaultValue: 'こんにちはなのだ'
              }
            }
          },
          {
            opcode: 'speak',
            blockType: Scratch.BlockType.COMMAND,
            text: '[TEXT] としゃべる',
            arguments: {
              TEXT: {
                type: Scratch.ArgumentType.STRING,
                defaultValue: 'ずんだもんなのだ'
              }
            }
          },
          '---',
          {
            opcode: 'setSpeaker',
            blockType: Scratch.BlockType.COMMAND,
            text: '話者IDを [ID] にする',
            arguments: {
              ID: {
                type: Scratch.ArgumentType.NUMBER,
                defaultValue: 3
              }
            }
          },
          {
            opcode: 'getSpeaker',
            blockType: Scratch.BlockType.REPORTER,
            text: '現在の話者ID'
          }
        ]
      };
    }

    /**
     * 話者IDを設定する
     */
    setSpeaker(args) {
      this.speakerId = args.ID;
    }

    /**
     * 現在の話者IDを取得する
     */
    getSpeaker() {
      return this.speakerId;
    }

    /**
     * 音声合成を実行し、再生する（待機あり）
     */
    async speakAndWait(args) {
      await this._synthesize(args.TEXT);
    }

    /**
     * 音声合成を実行し、再生する（待機なし）
     */
    speak(args) {
      // 待機しないが、処理自体は非同期で実行
      this._synthesize(args.TEXT);
    }

    /**
     * WEB APIと通信して音声を合成・再生する本体
     * @param {string} text 読み上げるテキスト
     */
    async _synthesize(text) {
      if (!text) return; // テキストが空なら何もしない

      // 連続リクエスト防止（APIに負荷をかけないため）
      const now = Date.now();
      if (now - this.lastSynthesisTime < 1000) {
        // 前回の実行から1秒未満なら待機
        await new Promise(resolve => setTimeout(resolve, 1000 - (now - this.lastSynthesisTime)));
      }
      this.lastSynthesisTime = Date.now();

      // 既存の再生があれば停止する
      if (this.audioPlayer) {
        this.audioPlayer.pause();
        this.audioPlayer = null;
      }

      try {
        // ステップ1: APIに合成リクエストを送信
        const params = new URLSearchParams({
          text: text,
          speaker: this.speakerId
        });

        // APIキーなしでリクエスト
        const response = await fetch(`${API_URL}?${params.toString()}`);
        
        if (!response.ok) {
          console.error('WEB版VOICEVOX API 失敗:', response.statusText);
          alert('WEB版VOICEVOXへの接続に失敗しました。');
          return;
        }

        const result = await response.json();

        if (!result.mp3DownloadUrl) {
           console.error('APIレスポンスエラー:', result);
           alert('音声URLの取得に失敗しました。');
           return;
        }

        // ステップ2: 取得した音声URLを再生
        const audioUrl = result.mp3DownloadUrl;
        this.audioPlayer = new Audio(audioUrl);
        
        // 再生が完了するまで待機するPromise
        await new Promise((resolve) => {
          this.audioPlayer.onended = resolve;
          this.audioPlayer.onerror = (e) => {
            console.error('音声の再生に失敗しました', e);
            alert('音声の再生に失敗しました。');
            resolve(); // エラーでも処理は続行
          };
          this.audioPlayer.play();
        });

      } catch (e) {
        console.error('VOICEVOX (Web) 拡張機能エラー:', e);
        alert('VOICEVOX (Web) 拡張機能でエラーが発生しました。コンソールを確認してください。');
      }
    }
  }

  // 拡張機能を登録
  Scratch.extensions.register(new VoicevoxWebExtension());
})(Scratch);