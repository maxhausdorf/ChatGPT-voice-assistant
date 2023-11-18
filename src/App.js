import './App.css';
import React, { useEffect, useRef, useState } from 'react';
import { OpenAIClient } from '@azure/openai';
import { AzureKeyCredential } from '@azure/openai';
import packagejson from '../package.json';
import { MdPlayCircleOutline, MdOutlinePauseCircleOutline, MdOutlinePanoramaFishEye, MdPlayArrow, MdRemove } from "react-icons/md";



function App() {

  const [lastPrompt, setLastPrompt] = useState('')
  const [responseData, setResponseData] = useState(null);
  const [chat, setChat] = useState([{ role: "system", content: "You are a helpful assistant. You get prompts which get generated by speech input through a microphone." }]);
  const [isRecording, setIsRecording] = useState(false);

  async function sendChatGptRequest(chat) {

    const client = new OpenAIClient(process.env.REACT_APP_AZURE_OPENAI_ENDPOINT, new AzureKeyCredential(process.env.REACT_APP_AZURE_OPENAI_KEY));
    const deploymentId = "gpt35";

    const result = await client.getChatCompletions(deploymentId, chat);
    const response = result.choices[0].message.content;
    console.log("This is the response!");
    console.log(response);
    setResponseData(response);
    return response;
  }

  const [audioEnabled, setAudioEnabled] = useState(false);
  const audioElementRef = useRef(new Audio());

  //This function exists because of the autoplay barrier of iOS
  //By playing a mp3 file without any noise recorded the user agrees to audio being played (apparently)
  function toggleAudio() {
    if (!audioEnabled) {
      audioElementRef.current.src = '/ChatGPT-voice-assistant/one_minute_of_silence.mp3';
      audioElementRef.current.play();
    }
    setAudioEnabled(!audioEnabled);
    enableMicrophone();
  }

  //This function request access for the microphone from the user. Somehow this results in a decrease of the volume. TODO: investigate this and resolve this.
  async function enableMicrophone() {
    try {
      await navigator.mediaDevices.getUserMedia({ audio: true });
      //Inform the user that the microphone is ready
    } catch (error) {
      //Still TODO: Handle the error (user denied access etc.)
    }
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
          setResponseData(errorMessage); //this might solve one bug mentioned by orian. TODO: further investigate this!
          setLastPrompt(errorMessage);
          textToSpeech(errorMessage);
          resolve(null);
        }
      });
    });
  }

  const [isPlaying, setIsPlaying] = useState(false);
  const [isPaused, setIsPaused] = useState(false);

  const myPlayerRef = React.useRef(null);
  //const synthesizerRef = React.useRef(null);

  const sdk = require("microsoft-cognitiveservices-speech-sdk");
  const speechConfig = sdk.SpeechConfig.fromSubscription(process.env.REACT_APP_SPEECH_KEY, process.env.REACT_APP_SPEECH_REGION);
  //The line below changes the default voice. In localhost this sometimes caused weird behaviour - keep that in mind.
  //speechConfig.speechSynthesisVoiceName = 'en-US-BrandonNeural';
  const myPlayer = new sdk.SpeakerAudioDestination();
  const audioConfigTTS = sdk.AudioConfig.fromSpeakerOutput(myPlayer);
  let synthesizer = new sdk.SpeechSynthesizer(speechConfig, audioConfigTTS);

  function pauseAudio() {
    myPlayerRef.current.pause();
    setIsPlaying(false);
    setIsPaused(true);
  }

  function resumeAudio() {
    myPlayerRef.current.resume();
    setIsPlaying(true);
    setIsPaused(false);
  }

  function textToSpeech(textToSpeak) {
    myPlayer.onAudioStart = () => {
      setIsPaused(false);
      setIsPlaying(true);
      console.log("Set started playing right now!");
    }

    myPlayer.onAudioEnd = () => {
      setIsPlaying(false);
      console.log("Set stopped playing right now!");
    }

    myPlayerRef.current = myPlayer;
    //synthesizerRef.current = synthesizer;

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

  const speakInPromptBtnRef = useRef(null);

  useEffect(() => {
    if (!isPlaying && audioEnabled) {
      speakInPromptBtnRef.current.focus();
    }
  }, [isPlaying]);

  function updateChat(message) {
    return new Promise(resolve => {
      setChat(prevChat => {
        const updatedChat = [...prevChat, message];
        resolve(updatedChat);
        return updatedChat;
      });
    });
  }

  function handleClick() {
    audioElementRef.current.src = '/ChatGPT-voice-assistant/one_minute_of_silence.mp3';
    audioElementRef.current.play();
    runWorkFlow();
  }

  function ChatMessage({ role, content, index }) {

    const pairIndex = Math.ceil(index / 2);
    if (role === "user") {
      return (
        <div className='chat-user'>
          <h4>Prompt {pairIndex}</h4>
          <p>{content}</p>
          <div className='audio-controls'>
          {/*!isPlaying && (<button className="play-audio-button" onClick={() => (textToSpeech(content))}>Play Prompt {pairIndex}</button>)*/}
          {/*isPlaying && (<button className="play-audio-button" onClick={() => (pauseAudio())} >Pause</button>)*/}
          {/*isPlaying || (isPaused && (<button style={{ marginTop: "10px" }} className="play-audio-button" onClick={() => (resumeAudio())}  >Resume</button>))*/}
          {!isPlaying && (<MdPlayCircleOutline role='button' style={{ marginTop: "10px", fontSize: '40px' }} onClick={() => (textToSpeech(content))} />)}
          {isPlaying && (<MdOutlinePauseCircleOutline role='button' style={{ marginTop: "10px", fontSize: '40px' }} onClick={() => (pauseAudio())} />)}
          {/*isPlaying || (isPaused && <MdPlayCircleOutline style={{ marginTop: "10px", fontSize: '40px' }} onClick={() => (resumeAudio())} />)*/}
          {isPlaying || (isPaused && <div role='button' className='resume-button' onClick={() => (resumeAudio())}>
            <MdOutlinePanoramaFishEye className='circle-icon'/>
            <MdPlayArrow className='play-icon'/>
            <MdRemove className='bar-icon'/>
          </div>)}
          </div>
        </div>
      )
    } else if (role === "assistant") {
      return (
        <div className='chat-ai'>
          <h4>Answer {pairIndex}</h4>
          <p>{content}</p>
          <div className='audio-controls'>
          {/*!isPlaying && (<button className="play-audio-button" onClick={() => (textToSpeech(content))}>Play Answer {pairIndex}</button>)*/}
          {/*isPlaying && (<button className="play-audio-button" onClick={() => (pauseAudio())}>Pause</button>)*/}
          {/*isPlaying || (isPaused && (<button style={{ marginTop: "10px" }} className="play-audio-button" onClick={() => (resumeAudio())} >Resume</button>))*/}
          {!isPlaying && (<MdPlayCircleOutline role='button' style={{ marginTop: "10px", fontSize: '40px' }} onClick={() => (textToSpeech(content))} />)}
          {isPlaying && (<MdOutlinePauseCircleOutline role='button' style={{ marginTop: "10px", fontSize: '40px'}} onClick={() => (pauseAudio())} />)}
          {/*isPlaying || (isPaused && <MdPlayCircleOutline role='button' style={{ marginTop: "10px", fontSize: '40px' }} onClick={() => (resumeAudio())} />)*/}
          {isPlaying || (isPaused && <div role='button' className='resume-button' onClick={() => (resumeAudio())}>
            <MdOutlinePanoramaFishEye className='circle-icon'/>
            <MdPlayArrow className='play-icon'/>
            <MdRemove className='bar-icon'/>
          </div>)}
          </div>
        </div>
      )
    }
  }


  const audioStartRef = React.useRef(new Audio('/ChatGPT-voice-assistant/Recording_Sound_Start.m4a'));
  const audioEndRef = React.useRef(new Audio('/ChatGPT-voice-assistant/Recording_Sound_End.m4a'));

  async function runWorkFlow() {

    //audio signal that recording starts
    audioStartRef.current.play();

    //recording starts
    setIsRecording(true);
    const generatedPrompt = await sttFromMic();
    setIsRecording(false);

    //audio signal that recording ended
    audioEndRef.current.play();

    if (generatedPrompt) {

      let userChatUpdate = await updateChat({ role: "user", content: generatedPrompt });
      console.log("This is the updated chat after the prompt of the user:", userChatUpdate);


      const response = await sendChatGptRequest(userChatUpdate);

      let aiChatUpdate = await updateChat({ role: "assistant", content: response });
      console.log("This is the updated chat after the reply of chatGPT:", aiChatUpdate);

      //requestGotSent = true;
      //console.log(requestGotSent);
      textToSpeech(response);
    } else {
      console.log("No request got sent to ChatGPT");
    }
  }

/*  async function inputSpeechFunction() {
    //This function only exists because I am not able to input any stuff as speech in the library!
    let generatedPrompt = "This is a sample input, reply with a story. Use about one short sentence."
    let userChatUpdate = await updateChat({ role: "user", content: generatedPrompt });
    console.log("This is the updated chat after the prompt of the user:", userChatUpdate);


    const response = await sendChatGptRequest(userChatUpdate);

    let aiChatUpdate = await updateChat({ role: "assistant", content: response });
    console.log("This is the updated chat after the reply of chatGPT:", aiChatUpdate);

    //requestGotSent = true;
    //console.log(requestGotSent);
    textToSpeech(response);
  }
*/



  return (
    <div className="App">
      <header className="App-header">
        <h1>Welcome to the ChatGPT Voice Assistant</h1>
        {/*!audioEnabled && <h2>Please press the button below and allow microphone access when prompted.</h2>*/}
        {audioEnabled && <h2 className='instruction-header'>To create a prompt, press the first button below and start speaking. To hear the response, press the second button.</h2>}
        {/*!audioEnabled && <button onClick={toggleAudio}>
          {audioEnabled ? 'Disable Audio' : 'Enable Audio'}
  </button>*/}
      </header>
      {!audioEnabled && <div className='App-body'>
      <h2>Please press the button below and allow microphone access when prompted.</h2>
      <button style={{ color: "black", width: "100%", maxWidth: '20rem', height: "5vh", backgroundColor: "white", border: "2px solid white", boxShadow: "none", margin: '20px', boxShadow: 'inset 0px 0px 0px 2px black'}}
      onClick={toggleAudio}>
          Start Application
        </button>
        </div>}
      {audioEnabled &&
      <div className='App-body'>
        {/*<button style={{ width: '20rem', height: '10rem', backgroundColor: 'red' }} onClick={inputSpeechFunction}></button>*/}
        <button
          style={{ color: "white", width: "100%", maxWidth: '20rem', height: "5vh", backgroundColor: "#F05039", border: "2px solid white", boxShadow: "none", margin: '20px' }}
          
          onClick={handleClick}
          disabled={isPlaying || isRecording}
          ref={speakInPromptBtnRef}
        >
          Speak in your prompt
        </button>
        <button
          style={{ color: "white", width: "100%", maxWidth: '20rem', height: "5vh", backgroundColor: "#1F449C", border: "2px solid white", boxShadow: "none" }}
          onClick={() => textToSpeech(responseData)}
          disabled={isPlaying}
        >
          Play last ChatGPT response
        </button>
        <div className='chat'>
          <div className='header-chat'>
            <h3>Prompt:</h3>
            <h3>Answer from ChatGPT:</h3>
          </div>
          <div className='content-chat'>
            {/*<div className='chat-user'>
              <p>{lastPrompt}</p>
            </div>
            <div className='chat-ai'>
              <p>{responseData}</p>
            </div>*/}
            {chat.map((message, index) => (
              <ChatMessage index={index} key={index} role={message.role} content={message.content} />
            ))}
          </div>
        </div>
      </div>}
      <footer className='App-footer'>
        <p>Current Version: {packagejson.version}</p>
      </footer>

    </div>
  );
}

export default App;