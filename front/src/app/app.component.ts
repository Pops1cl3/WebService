import {Component, OnInit} from '@angular/core';
import {HttpClient, HttpHeaders} from '@angular/common/http';
import {environment} from "../environments/environment";
import {Injectable} from '@angular/core';
import {VoiceRecognitionService} from "./service/voice-recognition.service";
import {TextToSpeechService} from "./service/text-to-speech.service";

@Component({
    selector: 'app-root',
    templateUrl: './app.component.html',
    styleUrls: ['./app.component.scss']
})

@Injectable({
    providedIn: 'root'
})

export class AppComponent implements OnInit {

    public conversation = '';
    public voiceRecognitionState = 0;
    public voiceButtonColor = 'primary'
    private messages = [{'role': 'system', 'content': 'Vous êtes une IA très serviable'}];

    constructor(private http: HttpClient, public voiceRecognition: VoiceRecognitionService, public textToSpeech: TextToSpeechService) {
    }

    ngOnInit(): void {

        // microphone authorization
        navigator.mediaDevices.getUserMedia({audio: true});
        // init recognition system
        this.voiceRecognition.init();
        // init textToSpeech system
        this.textToSpeech.init();
    }

    voiceRecognitionSwitch() {
        if (this.voiceRecognitionState == 0) {
            this.voiceRecognition.start();
            this.voiceRecognitionState = 1;
            this.voiceButtonColor = 'warn'
        } else {
            this.voiceRecognition.stop();
            this.voiceRecognitionState = 0;
            this.voiceButtonColor = 'primary'
            this.callIA(this.voiceRecognition.text);
            this.voiceRecognition.text = '';
            this.voiceRecognition.tempWords = '';
        }
    }

    /**
     * https://huggingface.co/mistralai/Mistral-Small-24B-Instruct-2501?inference_api=true&inference_provider=together&language=curl
     * https://huggingface.co/stabilityai/stable-diffusion-3.5-large?inference_api=true&inference_provider=hf-inference&language=curl
     * @param text
     */
    callIA(text: string) { // 加上 : string 避免 text 类型标红
        this.conversation = this.conversation.concat('<br /><b>Me</b> : ' + text);

        // 根据 PDF 要求，判断是否以 "dessine-moi" 开头
        if (text.toLowerCase().startsWith('dessine-moi')) {
            
            // // ==========================================
            // // 1. 图像生成部分 (解锁原先的 image sample)
            // // ==========================================
            // let headers = new HttpHeaders({
            //     'Content-Type': 'application/json',
            //     // TODO 已完成：获取 environment 中的 API Key 用于 Hugging Face
            //     'Authorization': `Bearer ${environment.apiKey}`
            // });

            // // need to push all the conversation each time to keep the context
            // this.messages.push({'role': 'user', 'content': text});
            
            // // TODO 已完成：Hugging Face 图像接口需要的请求体格式
            // let requestData = { inputs: text }; 

            // const url = 'https://huggingface.co/stabilityai/stable-diffusion-3.5-large';
            // // TODO 已完成：填入 PDF 指定的 Stable Diffusion 3.5 接口地址
            // this.http.post<any>(url, JSON.stringify(requestData), {headers: headers, observe: 'response', responseType: 'blob' as 'json'})
            //   .subscribe(data => {
            //       this.addResponse('<img src="'+URL.createObjectURL(data.body)+'" />', false);
            //     },
            //     error => {
            //       console.log(error);
            //       this.addResponse("Erreur de génération d'image");
            //     });

            let headers = new HttpHeaders({
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${environment.apiKey}`
            });

            this.messages.push({'role': 'user', 'content': text});
            let requestData = { prompt: text };

            const cfUrl = `/cf-api/client/v4/accounts/${environment.accountId}/ai/run/@cf/black-forest-labs/flux-1-schnell`;

            this.http.post<any>(cfUrl, requestData, { headers: headers })
            .subscribe(response => {
                const imageUrl = 'data:image/jpeg;base64,' + response.result.image;
                this.addResponse('<img src="' + imageUrl + '" />', false);
            },
            error => {
                console.log(error);
                this.addResponse("Erreur de génération d'image");
            });

        } else {

            // ==========================================
            // 2. 文本对话部分 (原先的 text sample - 接入本地 Ollama)
            // ==========================================
            let headers = new HttpHeaders({
                'Content-Type': 'application/json'
            });

            this.messages.push({'role': 'user', 'content': text});
            
            // TODO 已完成：Ollama 请求体
            let requestData = {
                model: 'llama3.2',
                messages: this.messages,
                stream: false
            };

            // TODO 已完成：填入本地 Ollama API 地址
            this.http.post<any>('http://localhost:11434/api/chat', JSON.stringify(requestData), {headers: headers})
                .subscribe(data => {
                    // 修改点：适配 Ollama 的返回值路径
                    this.addResponse(data.message.content);
                },
                error => {
                   console.log(error);
                   this.addResponse(error.message);
                });
        }
    }

    addResponse(response: string, toVoice: boolean = true) {
        this.messages.push({'role': 'assistant', 'content': response});
        let htmlResponse = response.replace(/\\n/g, '<br/>');
        if (toVoice) {
          this.textToVoice(htmlResponse);
        }
        this.conversation = this.conversation.concat('<br /><b>IA</b> : ' + htmlResponse);
    }

    addImage(blob: Blob) {
      this.addResponse('<img src="'+URL.createObjectURL(blob)+'" />', false);
    }

    textToVoice(text:string) {
        this.textToSpeech.say(text);
    }
}
