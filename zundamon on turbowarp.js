// Turbowarp拡張機能のためのクラス定義
class ZundamonSushiApiWithCache {
    // ----------------------------------------------------
    // 1. 拡張機能の初期設定
    // ----------------------------------------------------
    constructor() {
        this.apiUrl = 'https://deprecatedapis.tts.quest/v2/voicevox/audio/';
        this.apiKey = ''; 
        this.speakerId = 3; 

        // 💡 音声キャッシュのためのMapを初期化
        // キー: テキスト + 話者ID (例: "ずんだもんなのだ_3")
        // 値: Promise<AudioBuffer> または AudioBuffer
        this.audioCache = new Map(); 

        // Web Audio APIの初期化
        this.audioContext = null;
        this.currentSourceNode = null;

        try {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        } catch (e) {
            console.error('Web Audio APIがサポートされていません。', e);
        }
    }

    // ----------------------------------------------------
    // 2. 拡張機能メタデータ
    // ----------------------------------------------------
    getInfo() {
        return {
            id: 'zundamonsushicache',
            name: 'ずんだもん音声合成(キャッシュ)',
            blockIconURI: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHZpZXdCb3g9IjAgMCA0MCA0MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KICA8Y2lyY2xlIGN4PSIyMCIgY3k9IjIwIiByPSIyMCIgZmlsbD0iIzI2QTZEMiIvPgogIDxwYXRoIGQ9MTE4LjQxMSA5LjEwNmwtMS4yMzEgNC4yNDgtNi43NTIgMy4zMjNMIDE1LjEgMTcuNTc1bC0yLjI5MiA1LjgyNCA0Ljc1LS4wOTcgMS44MDcgNS4zMDcgMy4xMTgtMi4wMDgtMS41ODQtNi43MThjLTMuNTgyLTEuMDg4LTIuNTI2LTYuNzctLjczOC03LjIyIDEuMDMtLjI0NiAzLjcyNC4wOSA0LjUwMiAyLjM2TDI4IDkuNTg3bC05LjU4OS0wLjQ4MXptNC41NTMgOC4wMThjLjE3NS0uMjU2LjYzNy0uMTI3LjY5OC4xNWMuMDI5LjE3Mi0wLjE2Ni40Mi0wLjQyMi4zNzEtMC4yODQtMC4wNTItMC4zNjYtMC4yNzUtMC4yNzYtMC41Yy4wMzItMC4wNzIuMDk5LTAuMDQ0LjE1Mi0wLjAyMXptMS4wNSAxLjUyOWMuMzczLjU2LjM5NyAxLjQzOC0wLjA2MSAxLjk2OC0wLjQyOS40ODktMS4yMDUuNjEyLTEuNjk4LjMxNC0wLjYwNi0wLjM2Mi0wLjc2LTEuMTA2LTAuNDA0LTEuNzEyLjMwNi0wLjUyLjkyNC0wLjc2IDEuNTE0LTAuMzl6IiBmaWxsPSIjRkZGRkZGIi8+Cjwvc3ZnPg==',
            blocks: [
                {
                    opcode: 'setApiKey',
                    blockType: Scratch.BlockType.COMMAND,
                    text: 'APIキーを [KEY] に設定する',
                    arguments: {
                        KEY: {
                            type: Scratch.ArgumentType.STRING,
                            defaultValue: 'APIキーをここに入力' 
                        }
                    }
                },
                {
                    opcode: 'setSpeakerId',
                    blockType: Scratch.BlockType.COMMAND,
                    text: 'ずんだもん (四国めたん) の声優IDを [ID] に設定する',
                    arguments: {
                        ID: {
                            type: Scratch.ArgumentType.NUMBER,
                            defaultValue: this.speakerId,
                            menu: 'speaker_id_menu'
                        }
                    }
                },
                {
                    // 以前のspeakTextブロックをキャッシュ対応版に置き換えます
                    opcode: 'speakText',
                    blockType: Scratch.BlockType.COMMAND,
                    text: '[TEXT] セリフを保存・再生する',
                    arguments: {
                        TEXT: {
                            type: Scratch.ArgumentType.STRING,
                            defaultValue: 'キャッシュから瞬時に再生するのだ。'
                        }
                    }
                }
            ],
            menus: {
                speaker_id_menu: {
                    acceptsReporters: true,
                    items: [
                        { text: 'ずんだもん (ノーマル)', value: 3 },
                        { text: '四国めたん (ノーマル)', value: 2 },
                        { text: 'ずんだもん (あまあま)', value: 1 },
                        { text: 'ずんだもん (つんつん)', value: 7 },
                        { text: 'ずんだもん (ささやき)', value: 20 }
                    ]
                }
            }
        };
    }

    // ----------------------------------------------------
    // 3. ブロック処理の実装 (API設定は変更なし)
    // ----------------------------------------------------
    
    setApiKey(args) {
        this.apiKey = args.KEY;
        console.log('APIキーを設定しました。（表示は省略）');
    }

    setSpeakerId(args) {
        this.speakerId = Number(args.ID); 
        console.log(`話者IDを設定しました: ${this.speakerId}`);
    }

    /**
     * 内部でAudioBufferを再生する共通関数
     * @param {AudioBuffer} audioBuffer - 再生する音声データ
     * @param {string} text - コンソール出力用のテキスト
     */
    playAudioBuffer(audioBuffer, text) {
        if (!this.audioContext) {
            console.error('Web Audio APIが利用できません。');
            return;
        }

        // 既存の再生を停止
        if (this.currentSourceNode) {
            this.currentSourceNode.stop();
            this.currentSourceNode = null;
        }
        
        try {
            const source = this.audioContext.createBufferSource();
            source.buffer = audioBuffer;
            source.connect(this.audioContext.destination);
            source.start(0);
            this.currentSourceNode = source;
            console.log(`再生を開始しました: 「${text}」`);
        } catch (e) {
            console.error('音声データの再生に失敗しました。', e);
        }
    }

    /**
     * テキストをWeb APIに送信し、音声データを受け取ってキャッシュに保存後、再生します。
     * キャッシュに存在する場合は即時再生します。
     */
    async speakText(args) {
        const text = args.TEXT;
        const cacheKey = `${text}_${this.speakerId}`; // テキストと話者IDの組み合わせをキーとする

        if (!this.audioContext) {
            console.error('Web Audio APIが利用できません。');
            return;
        }

        if (!this.apiKey) {
            alert('エラー: APIキーが設定されていません。');
            console.error('APIキーが設定されていません。');
            return;
        }

        // ------------------------------------
        // 1. キャッシュの確認
        // ------------------------------------
        if (this.audioCache.has(cacheKey)) {
            console.log(`✅ キャッシュヒット: 「${text}」を瞬時に再生します。`);
            
            // キャッシュの値がPromiseの場合は解決を待つ (同じ言葉を連続で呼び出した場合に対応)
            let cachedData = this.audioCache.get(cacheKey);
            if (cachedData instanceof Promise) {
                cachedData = await cachedData;
            }
            
            this.playAudioBuffer(cachedData, text);
            return;
        }

        // ------------------------------------
        // 2. キャッシュミス（APIリクエスト）
        // ------------------------------------
        
        // 合成処理のPromiseを一時的にキャッシュに保存
        const synthesisPromise = this._fetchAndDecodeAudio(text, this.speakerId);
        this.audioCache.set(cacheKey, synthesisPromise);

        let audioBuffer;
        try {
            audioBuffer = await synthesisPromise;
            // 成功したらPromiseの結果(AudioBuffer)でキャッシュを更新
            this.audioCache.set(cacheKey, audioBuffer); 
            
            this.playAudioBuffer(audioBuffer, text);

        } catch (error) {
            // エラーが発生したらキャッシュから削除
            this.audioCache.delete(cacheKey); 
            alert(`音声合成エラー: ${error.message}`);
            console.error('音声合成エラー:', error);
            return;
        }
    }
    
    /**
     * APIを呼び出し、音声データを取得・デコードするプライベートメソッド
     * @param {string} text - 読み上げるテキスト
     * @param {number} speakerId - 話者ID
     * @returns {Promise<AudioBuffer>} - デコードされたAudioBuffer
     */
    async _fetchAndDecodeAudio(text, speakerId) {
        console.log(`➡️ APIリクエスト: 「${text}」の音声合成を開始します。`);
        const encodedText = encodeURIComponent(text);
        
        // APIキーとパラメータをクエリ文字列として構築
        const fullUrl = `${this.apiUrl}?text=${encodedText}&key=${this.apiKey}&speaker=${speakerId}`;

        let synthesisResponse;
        try {
            synthesisResponse = await fetch(fullUrl, { method: 'GET' });
        } catch (e) {
            throw new Error('Web APIへの接続に失敗しました。ネットワークを確認してください。');
        }

        if (!synthesisResponse.ok) {
            const errorText = await synthesisResponse.text();
            let errorMessage = `HTTPエラー (${synthesisResponse.status} ${synthesisResponse.statusText})`;
            if (errorText.includes('invalidApiKey')) {
                errorMessage = 'APIキーが無効です。';
            } else if (errorText.includes('notEnoughPoints')) {
                errorMessage = 'ポイントが不足しています。';
            } else if (errorText.includes('failed')) {
                errorMessage = '音声合成に失敗しました。';
            }
            throw new Error(errorMessage);
        }

        const audioData = await synthesisResponse.arrayBuffer();
        
        // AudioBufferへのデコードは非同期処理
        try {
            return await this.audioContext.decodeAudioData(audioData);
        } catch (e) {
            throw new Error('APIから返された音声データのデコードに失敗しました。');
        }
    }
}

// Scratch/Turbowarpに拡張機能クラスを登録
Scratch.extensions.register(new ZundamonSushiApiWithCache());
