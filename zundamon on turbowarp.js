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
            const AudioCtx = window.AudioContext || window.webkitAudioContext;
            if (AudioCtx) {
                this.audioContext = new AudioCtx();
            }
        } catch (e) {
            console.error('Web Audio APIがサポートされていません。', e);
        }
    }

    // ----------------------------------------------------
    // 2. 拡張機能メタデータ
    // ----------------------------------------------------
    getInfo() {
        // アイコン右側の余計な要素（ゴミ）を除去したクリーンな吹き出しSVG
        const svgIcon = `<svg width="40" height="40" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">
            <rect width="512" height="512" rx="100" fill="#26A65B"/>
            <path d="M410.871,280.932c0-82.909-80.457-150.119-179.702-150.119c-99.256,0-179.712,67.21-179.712,150.119c0,50.111,29.387,94.27,74.721,121.758c-8.91,28.847-28.533,52.269-28.843,52.63c-3.193,3.712-3.81,9.022-1.546,13.338c2.263,4.316,6.73,7.032,11.603,7.032c43.642,0,81.428-21.362,106.311-38.314c5.78,0.85,11.664,1.3,17.466,1.3C330.414,431.051,410.871,363.841,410.871,280.932z" fill="#FFFFFF"/>
        </svg>`;
        const iconURI = `data:image/svg+xml;utf8,${encodeURIComponent(svgIcon)}`;

        return {
            id: 'zundamonsushicache',
            name: 'ずんだもん音声合成(キャッシュ)',
            blockColor1: '#26A65B', // ブロック本体 (ずんだグリーン)
            blockColor2: '#1E824C', // 枠線・入力欄
            blockColor3: '#145A32', // ドロップダウンなどの暗い色
            blockIconURI: iconURI,
            menuIconURI: iconURI,
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
                    opcode: 'getApiKey',
                    blockType: Scratch.BlockType.REPORTER,
                    text: 'APIキー'
                },
                {
                    opcode: 'setSpeakerId',
                    blockType: Scratch.BlockType.COMMAND,
                    text: 'ずんだもん (四国めたん) の声優IDを [ID] に設定する',
                    arguments: {
                        ID: {
                            type: Scratch.ArgumentType.NUMBER,
                            defaultValue: 3,
                            menu: 'speaker_id_menu'
                        }
                    }
                },
                {
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
    // 3. ブロック処理の実装
    // ----------------------------------------------------
    
    setApiKey(args) {
        this.apiKey = String(args.KEY || '');
        console.log('APIキーを設定しました。');
    }

    getApiKey() {
        return this.apiKey || '';
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

        if (this.currentSourceNode) {
            try {
                this.currentSourceNode.stop();
            } catch (e) {
                // 無視
            }
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
        const text = String(args.TEXT || '');
        const cacheKey = `${text}_${this.speakerId}`;

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
        
        const synthesisPromise = this._fetchAndDecodeAudio(text, this.speakerId);
        this.audioCache.set(cacheKey, synthesisPromise);

        let audioBuffer;
        try {
            audioBuffer = await synthesisPromise;
            this.audioCache.set(cacheKey, audioBuffer); 
            
            this.playAudioBuffer(audioBuffer, text);

        } catch (error) {
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
        
        try {
            return await this.audioContext.decodeAudioData(audioData);
        } catch (e) {
            throw new Error('APIから返された音声データのデコードに失敗しました。');
        }
    }
}

// Scratch/Turbowarpに拡張機能クラスを登録
Scratch.extensions.register(new ZundamonSushiApiWithCache());