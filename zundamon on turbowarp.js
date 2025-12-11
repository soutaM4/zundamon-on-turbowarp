// Turbowarp Zundamon (Web API) Extension
(function (Scratch) {
  'use strict';

  // WEB版VOICEVOX (tts.quest) の APIエンドポイント
  const API_URL = 'https://api.tts.quest/v3/voicevox/synthesis';
  // 連続リクエスト防止のための最小間隔 (ミリ秒)
  const MIN_INTERVAL = 1000;

  class VoicevoxWebExtension {
    constructor() {
      this.speakerId = 3; 
      this.audioPlayer = null; 
      this.lastSynthesisTime = 0; 
      // ★新しい変数: 待機を解除するための関数
      this.currentResolve = null; 
      this.currentReject = null;
    }

    // ... (getInfo, setSpeaker, getSpeaker は変更なし。前回の安定化コードを参照)

    getInfo() {
        return {
          id: 'voicevoxweb',
          name: 'ずんだもん TTS (Web)',
          color1: '#81c784',
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

      setSpeaker(args) {
        const newId = Number(args.ID);
        if (!isNaN(newId) && newId > 0) {
          this.speakerId = newId;
        } else {
          console.warn('無効な話者IDが設定されました:', args.ID);
        }
      }

      getSpeaker() {
        return this.speakerId;
      }
      
    // 待機ありのブロック
    async speakAndWait(args) {
      await this._synthesize(args.TEXT);
    }

    // 待機なしのブロック
    speak(args) {
      this._synthesize(args.TEXT).catch(() => {});
    }


    /**
     * WEB APIと通信して音声を合成・再生する本体
     * @param {string} text 読み上げるテキスト
     */
    async _synthesize(text) {
      if (!text) return;

      // ===========================================
      // 1. 中断処理: 既存の処理を停止し、待機中のPromiseを強制終了する
      // ===========================================
      if (this.audioPlayer) {
        this.audioPlayer.pause();
      }

      // ★重要: speakAndWaitで待機中のPromiseを即座に解決し、ブロックを再開させる
      if (this.currentResolve) {
        this.currentResolve();
        // Resolveしたら、すぐにリセット
        this.currentResolve = null;
        this.currentReject = null;
      }
      
      // AudioPlayerリソースのクリーンアップ
      if (this.audioPlayer) {
          this.audioPlayer.onended = null;
          this.audioPlayer.onerror = null;
          this.audioPlayer = null;
      }
      
      // 連続リクエスト防止 (前回の安定化コードと同様)
      const now = Date.now();
      const timeElapsed = now - this.lastSynthesisTime;

      if (timeElapsed < MIN_INTERVAL) {
        const timeToWait = MIN_INTERVAL - timeElapsed;
        await new Promise(resolve => setTimeout(resolve, timeToWait));
        this.lastSynthesisTime = Date.now();
      } else {
        this.lastSynthesisTime = now;
      }

      // ===========================================
      // 2. 音声合成と再生
      // ===========================================
      try {
        // ... (APIリクエスト部分は前回の安定化コードと同様)
        const params = new URLSearchParams({
            text: text,
            speaker: this.speakerId
        });
        const response = await fetch(`${API_URL}?${params.toString()}`);
        
        if (!response.ok) {
            const errorDetail = await response.text().catch(() => response.statusText);
            console.error(`WEB版VOICEVOX API 失敗: ステータス ${response.status} - ${errorDetail}`);
            alert(`WEB版VOICEVOXへの接続に失敗しました (Status: ${response.status})。`);
            return;
        }

        const result = await response.json();

        if (!result.mp3DownloadUrl) {
            console.error('APIレスポンスエラー: mp3DownloadUrlが見つかりません', result);
            alert('音声URLの取得に失敗しました。');
            return;
        }

        const audioUrl = result.mp3DownloadUrl;
        this.audioPlayer = new Audio(audioUrl);

        // 再生完了まで待機するPromise
        await new Promise((resolve, reject) => {
            // ★重要: 待機解除用の関数を保存
            this.currentResolve = resolve;
            this.currentReject = reject;

            this.audioPlayer.onended = resolve;
            this.audioPlayer.onerror = (e) => {
                console.error('音声の再生に失敗しました', e);
                alert('音声の再生に失敗しました。');
                reject(new Error('Audio playback failed.'));
            };
            this.audioPlayer.play().catch(e => {
                console.error('Audio play() Promise error:', e);
                alert('音声の自動再生がブロックされました。ユーザー操作が必要です。');
                reject(new Error('Audio play() failed.'));
            });
        });

      } catch (e) {
        console.error('VOICEVOX (Web) 拡張機能エラー:', e);
      } finally {
        // ===========================================
        // 3. 処理の終了とクリーンアップ
        // ===========================================
        if (this.audioPlayer) {
            this.audioPlayer.onended = null;
            this.audioPlayer.onerror = null;
        }
        this.audioPlayer = null;
        
        // ★重要: 待機解除用の関数もリセット
        this.currentResolve = null;
        this.currentReject = null;
      }
    }
  }

  // 拡張機能を登録
  Scratch.extensions.register(new VoicevoxWebExtension());
})(Scratch);
