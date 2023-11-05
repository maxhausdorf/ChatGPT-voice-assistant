import './App.css';
import React, { useState, useEffect } from 'react';
import { OpenAIClient } from '@azure/openai';
import { AzureKeyCredential } from '@azure/openai';
import packagejson from '../package.json';


function App() {

  const [lastPrompt, setLastPrompt] = useState('')
  const [responseData, setResponseData] = useState(null);

  async function sendChatGptRequest(prompt) {

    const client = new OpenAIClient(process.env.REACT_APP_AZURE_OPENAI_ENDPOINT, new AzureKeyCredential(process.env.REACT_APP_AZURE_OPENAI_KEY));
    const deploymentId = "gpt35";
    const messages = [
      { role: "system", content: "You are a helpful assistant. You get prompts which get generated by speech input through a microphone." },
      { role: "user", content: prompt }
    ]
    const result = await client.getChatCompletions(deploymentId, messages);
    const response = result.choices[0].message.content;
    console.log("This is the type: ")
    console.log(typeof response);
    console.log("This is the response!");
    console.log(response);
    setResponseData(response);
    return response;
  }

  async function sttFromMic() {

    return new Promise((resolve, reject) => {

      const sdk = require("microsoft-cognitiveservices-speech-sdk");
      const speechConfig = sdk.SpeechConfig.fromSubscription(process.env.REACT_APP_SPEECH_KEY, process.env.REACT_APP_SPEECH_REGION);
      speechConfig.speechRecognitionLanguage = 'en-US';

      const audioConfig = sdk.AudioConfig.fromDefaultMicrophoneInput();
      const recognizer = new sdk.SpeechRecognizer(speechConfig, audioConfig);

      setResponseData('speak into your microphone...')

      recognizer.recognizeOnceAsync(result => {
        if (result.reason === sdk.ResultReason.RecognizedSpeech) {
          console.log(`RECOGNIZED PROMPT: Text=${result.text}`)
          setLastPrompt(result.text);
          resolve(result.text);
        } else {
          const errorMessage = 'ERROR: Speech was cancelled or could not be recognized. Ensure your microphone is working properly.';
          setLastPrompt(errorMessage);
          textToSpeech(errorMessage);
          resolve(null);
        }
      });
    });
  }

  const [isPlaying, setIsPlaying] = useState(false);

  function textToSpeech(textToSpeak) {
    const sdk = require("microsoft-cognitiveservices-speech-sdk");
    const speechConfig = sdk.SpeechConfig.fromSubscription(process.env.REACT_APP_SPEECH_KEY, process.env.REACT_APP_SPEECH_REGION);
    const myPlayer = new sdk.SpeakerAudioDestination();
    myPlayer.onAudioStart = () => {
      setIsPlaying(true);
      console.log("Set started playing right now!");
    }

    myPlayer.onAudioEnd = () => {
      setIsPlaying(false);
      console.log("Set stopped playing right now!");
    }

    const audioConfig = sdk.AudioConfig.fromSpeakerOutput(myPlayer);

    let synthesizer = new sdk.SpeechSynthesizer(speechConfig, audioConfig);

    //const textToSpeak = 'This is an example of speech synthesis for a long passage of text. Pressing the mute button should pause/resume the audio output.';
    console.log(`speaking text: ${textToSpeak}...`);

    synthesizer.speakTextAsync(
      textToSpeak,
      result => {
        let text;
        if (result.reason === sdk.ResultReason.SynthesizingAudioCompleted) {
          text = `synthesis finished for "${textToSpeak}".\n`
        } else if (result.reason === sdk.ResultReason.Canceled) {
          text = `synthesis failed. Error detail: ${result.errorDetails}.\n`
        }
        synthesizer.close();
        synthesizer = undefined;
        console.log(text);
      },
      function (err) {
        console.log(`Error: ${err}.\n`);

        synthesizer.close();
        synthesizer = undefined;
      });

  }

  const audioStartRef = React.useRef(new Audio('/ChatGPT-voice-assistant/Recording_Sound_Start.m4a'));
  const audioEndRef = React.useRef(new Audio('/ChatGPT-voice-assistant/Recording_Sound_End.m4a'));

  async function runWorkFlow() {

    audioStartRef.current.play();

    const generatedPrompt = await sttFromMic();
    audioEndRef.current.play();

    if (generatedPrompt) {
      const response = await sendChatGptRequest(generatedPrompt);

      //requestGotSent = true;
      //console.log(requestGotSent);
      //textToSpeech(response);
    } else {
      console.log("No request got sent to ChatGPT");
    }
  }




  return (
    <div className="App">
      <header className="App-header">
        {/*<div>To create a prompt, press the first button below and start speaking. To hear the response, press the second button.</div>*/}
        <h6 className='instruction-header'>To create a prompt, press the first button below and start speaking. To hear the response, press the second button.</h6>
      </header>
      <div className='App-body'>
        <button
          style={{ color: "white", width: "100%", maxWidth: '20rem', height: "5vh", backgroundColor: "#F05039", border: "2px solid white", boxShadow: "none", margin: '20px' }}
          onClick={runWorkFlow}
          disabled={isPlaying}
        >
          Speak in your prompt
        </button>
        <button
          style={{ color: "white", width: "100%", maxWidth: '20rem', height: "5vh", backgroundColor: "#1F449C", border: "2px solid white", boxShadow: "none" }}
          onClick={() => textToSpeech(responseData)}
          disabled={isPlaying}
        >
          Play ChatGPT response
        </button>
        <div className='chat'>
          <div className='header-chat'>
          <h4>Prompt:</h4>
          <h4>Answer from ChatGPT:</h4>
          </div>
          <div className='chat-user'>

            <p>{lastPrompt}</p>
          </div>
          <div className='chat-ai'>
            <p>{responseData}</p>
          </div>
        </div>
      </div>
      <footer className='App-footer'>
        <p>Current Version: {packagejson.version}</p>
      </footer>

    </div>
  );
}

export default App;
