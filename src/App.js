import './App.css';
import React, { useEffect, useRef, useState } from 'react';
import { OpenAIClient } from '@azure/openai';
import { AzureKeyCredential } from '@azure/openai';
import packagejson from '../package.json';
import { MdChatBubbleOutline, MdChat, MdPlayCircleOutline, MdOutlinePauseCircleOutline, MdOutlinePanoramaFishEye, MdPlayArrow, MdRemove, MdMicNone } from "react-icons/md";



function App() {

  const [lastPrompt, setLastPrompt] = useState('')
  const [responseData, setResponseData] = useState(null);
  const [chat, setChat] = useState([{ role: "system", content: "You are a helpful assistant. You get prompts which get generated by speech input through a microphone." }]);
  const [isRecording, setIsRecording] = useState(false);
  const [viewHistory, setViewHistory] = useState(false);
  const [titleCurrentChat, setTitleCurrentChat] = useState('');
  const [inMainMenu, setInMainMenu] = useState(false);
  const [isChatExpanded, setIsChatExpanded] = useState(null); // TO DO: if there is only one chat visible, no dropdown/summary is needed to display
  const [playingMessageIndex, setPlayingMessageIndex] = useState(null);


  async function sendChatGptRequest(chat) {

    const client = new OpenAIClient(process.env.REACT_APP_AZURE_OPENAI_ENDPOINT, new AzureKeyCredential(process.env.REACT_APP_AZURE_OPENAI_KEY));
    const deploymentId = "gpt35";

    const result = await client.getChatCompletions(deploymentId, chat);
    const response = result.choices[0].message.content;
    //console.log("This is the response!");
    //console.log(response);
    setResponseData(response);
    return response;
  }

  const [audioEnabled, setAudioEnabled] = useState(false);
  const audioElementRef = useRef(new Audio());
  const [micAccessDenied, setMicAccessDenied] = useState(false);

  //This function exists because of the autoplay barrier of iOS
  //By playing a mp3 file without any noise recorded the user agrees to audio being played (apparently)
  async function toggleAudio() {
    localStorage.clear();
    if (!audioEnabled) {
      audioElementRef.current.src = '/ChatGPT-voice-assistant/one_minute_of_silence.mp3';
      audioElementRef.current.play();
    }
    await enableMicrophone(); //this needs to get awaited and if the promise is not resolved properly then audio should not get set to enabled (if the user denied access)
    //setAudioEnabled(!audioEnabled);
  }

  //This function requests access for the microphone from the user. Somehow this results in a decrease of the volume. TODO: investigate this and resolve this.
  async function enableMicrophone() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      //console.log("Microphone access granted: ", stream);
      setMicAccessDenied(false);
      //console.log("micAccessDenied state set to false");
      setAudioEnabled(true);
      //Inform the user that the microphone is ready

    } catch (error) {
      console.log("Error accessing microphone: ", error);
      setMicAccessDenied(true);
      console.log("micAccessDenied state set to true");
      setAudioEnabled(false);
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
          //console.log(`RECOGNIZED PROMPT: Text=${result.text}`)
          setLastPrompt(result.text);
          resolve(result.text);
        } else {
          const errorMessage = 'ERROR: Speech was cancelled or could not be recognized. Ensure your microphone is working properly.';
          setResponseData(errorMessage); //this might solve one bug mentioned by orian. TODO: further investigate this!
          setLastPrompt(errorMessage);
          textToSpeech(errorMessage, 0); //TODO: check if 0 is the correct index here. (Can we just leave it out even?)
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

  function textToSpeech(textToSpeak, messageId) {
    //console.log("This is the index of the current message playing: " + messageId);
    //console.log("This is the current chat: " + chat);
    myPlayer.onAudioStart = () => {
      setIsPaused(false);
      setIsPlaying(true);
      setPlayingMessageIndex(messageId);
      //console.log("Set started playing right now!");
    }

    myPlayer.onAudioEnd = () => {
      setIsPlaying(false);
      //console.log("Set stopped playing right now!");
    }

    myPlayerRef.current = myPlayer;
    //synthesizerRef.current = synthesizer;

    //console.log(`speaking text: ${textToSpeak}...`);

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
        //console.log(text);
      },
      function (err) {
        //console.log(`Error: ${err}.\n`);

        synthesizer.close();
        synthesizer = undefined;
      });

  }

  const speakInPromptBtnRef = useRef(null);

  useEffect(() => {
    if (!isPlaying && audioEnabled && !isPaused) {
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

  function toggleChatExpansion() {
    setIsChatExpanded(prev => !prev);
    speakInPromptBtnRef.current.focus();
  }

  function ChatMessage({ role, content, index, isPlaying, isPaused }) {

    const pauseButtonRef = useRef(null);
    const resumeButtonRef = useRef(null);

    useEffect(() => {
      if (isPlaying) {
        if (pauseButtonRef.current) {
          pauseButtonRef.current.focus();
        }
      }
    }, [index, playingMessageIndex, isPlaying, isPaused]);

    useEffect(() => {
      if (isPaused) {
        if (resumeButtonRef.current) {
          resumeButtonRef.current.focus();
        }
      }
    }, [index, playingMessageIndex, isPlaying, isPaused])

    if (!isChatExpanded && index < chat.length - 2) { return null; }

    const baseTabIndex = index * 6;
    const tabIndex1 = baseTabIndex + 1;
    const tabIndex2 = baseTabIndex + 2;
    const tabIndex3 = baseTabIndex + 3;
    const tabIndex4 = baseTabIndex + 4;
    const tabIndex5 = baseTabIndex + 5;
    const tabIndex6 = baseTabIndex + 6;
    const titleWithWhitespace = content.slice(0, 20);
    const title = titleWithWhitespace.trim();

    const pairIndex = Math.ceil(index / 2);
    if (role === "user") {
      return (
        <div className='chat-user'>
          {/*  aria-label='chat message' tabIndex={tabIndex1}  */}
          <h3 aria-label={'user message header: ' + title} tabIndex={tabIndex2}>Prompt {pairIndex} {title}</h3>
          {/*<p aria-label='user message' tabIndex={tabIndex3}>{content}</p>*/}
          <p>{content}</p>
          <div className='audio-controls'>
            {!isPlaying && (<button className='audio-control-button-user' aria-label='Play Prompt Audio' tabIndex={tabIndex4} role='button' style={{ marginTop: "10px", fontSize: '40px' }} onClick={() => (textToSpeech(content, index))} ><MdPlayCircleOutline /></button>)}
            {(index === playingMessageIndex) && isPlaying &&
              (<button className='audio-control-button-user'
                aria-label='Pause Prompt Audio'
                tabIndex={tabIndex5}
                role='button'
                style={{ marginTop: "10px", fontSize: '40px' }}
                onClick={() => (pauseAudio())}
                ref={pauseButtonRef}
              >
                <MdOutlinePauseCircleOutline />
              </button>
              )}
            {(index === playingMessageIndex) && isPaused && (<button className='resume-button-user' aria-label='Resume Prompt Audio' tabIndex={tabIndex6} role='button' onClick={() => (resumeAudio())} ref={resumeButtonRef}>
              <MdOutlinePanoramaFishEye className='circle-icon' />
              <MdPlayArrow className='play-icon' />
              <MdRemove className='bar-icon' />
            </button>)}
            <button className='audio-control-button-user' style={{ marginTop: "10px", fontSize: '40px', color: 'black', opacity: '0.0' }} tabIndex={-1} aria-hidden="true"><MdPlayCircleOutline /></button> {/* This element is only here to keep the container from collapsing */}
          </div>
        </div>
      )
    } else if (role === "assistant") {
      return (
        <div className='chat-ai'>
          {/*  aria-label='chat message' tabIndex={tabIndex1}  */}
          <h3 aria-label={'assistant message header: ' + title} tabIndex={tabIndex2}>Answer {pairIndex} {title}</h3>
          {/*<p aria-label='assistant response' tabIndex={tabIndex3}>{content}</p>*/}
          <p>{content}</p>
          <div className='audio-controls'>
            <button className='audio-control-button-ai' style={{ marginTop: "10px", fontSize: '40px', color: 'white', opacity: '0.0' }} tabIndex={-1} aria-hidden="true"><MdPlayCircleOutline /></button> {/* This element is only here to keep the container from collapsing */}
            {!isPlaying && (<button className='audio-control-button-ai' aria-label='Play Response Audio' tabIndex={tabIndex4} role='button' style={{ marginTop: "10px", fontSize: '40px' }} onClick={() => (textToSpeech(content, index))} ><MdPlayCircleOutline /></button>)}
            {(index === playingMessageIndex) && isPlaying &&
              (<button className='audio-control-button-ai'
                aria-label='Pause Response Audio'
                tabIndex={tabIndex5}
                role='button'
                style={{ marginTop: "10px", fontSize: '40px' }}
                onClick={() => (pauseAudio())}
                ref={pauseButtonRef}
              >
                <MdOutlinePauseCircleOutline />
              </button>)}
            {(index === playingMessageIndex) && isPaused && (<button className='resume-button-ai' aria-label='Resume Response Audio' tabIndex={tabIndex6} role='button' onClick={() => (resumeAudio())} ref={resumeButtonRef}>
              <MdOutlinePanoramaFishEye className='circle-icon' />
              <MdPlayArrow className='play-icon' />
              <MdRemove className='bar-icon' />
            </button>)}
          </div>
        </div>
      )
    }
  }

  function toggleAudioPlayback() {
    if (isPlaying) {
      pauseAudio();
    } else if (isPaused) {
      resumeAudio();
    } else if (!isPaused && !isPlaying) {
      // textToSpeech(chat[chat.length].content);

    }
  }
  /*
    useEffect(() => {
      if (chat.length > 1) {
        console.log(chat.length);
        const handleKeyDown = (event) => {
          if (event.code === "Space") {
            event.preventDefault();
            toggleAudioPlayback();
          }
        };
        window.addEventListener('keydown', handleKeyDown);
      }
    }, [isPlaying, chat.length]);
  */

  function ChatList() {
    const chatData = localStorage.getItem('chatData');
    if (!chatData) { return (<div className='chat-history'></div>) } //this fixed a bug when displaying the past chats without any chats existing
    const chatObject = JSON.parse(chatData);
    const chatNames = Object.keys(chatObject);
    console.log('These are all the chat names!');
    console.log(chatNames);

    return (
      <div className='chat-history'>
        {chatNames.map((chatName, index) => (
          <button
            className='app-button go-to-chat-button'
            key={index}
            disabled={isPlaying || isRecording}
            onClick={() => { goToChat(chatName) }}
          >
            {chatName}
          </button>
        ))}
      </div>
    )
  }

  function ChatListMobile() {
    const chatData = localStorage.getItem('chatData');
    if (!chatData) { return (<div className='chat-history'></div>) } //this fixed a bug when displaying the past chats without any chats existing
    const chatObject = JSON.parse(chatData);
    const chatNames = Object.keys(chatObject);
    //console.log('These are all the chat names!');
    //console.log(chatNames);

    return (
      <div className='chat-history' style={{marginTop: '15px', backgroundColor: 'none'}}>
        {chatNames.map((chatName, index) => (
          <button
            key={index}
            disabled={isPlaying || isRecording}
            onClick={() => { goToChat(chatName) }}
            style={{display: 'flex', borderRadius: '10px', alignItems: 'center', justifyContent: 'center', background: 'blue', border: '1px solid white', padding: '0px', width: '43px', height: '38px', marginBottom: '10px', overflow: 'scroll'}}
          >
            <MdChatBubbleOutline style={{ fontSize: '30px', color: 'white'}}/>
            <span style={{marginLeft: '2px', marginBottom: '5px', color: 'white', position: 'absolute', fontSize: '15px'}}>{index+1}</span>
          </button>
        ))}
      </div>
    )
  }

  function goToChat(chatName) {
    setViewHistory(false);
    setTitleCurrentChat(chatName);
    const chatData = localStorage.getItem('chatData');
    const chatObject = JSON.parse(chatData);
    //console.log(chatObject[chatName]); Started debugging the faulty numeration TODO: solve this!
    const chatHistory = chatObject[chatName];
    setChat(chatHistory);
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
      //console.log("This is the updated chat after the prompt of the user:", userChatUpdate);


      const response = await sendChatGptRequest(userChatUpdate);

      let aiChatUpdate = await updateChat({ role: "assistant", content: response });
      //console.log("This is the updated chat after the reply of chatGPT:", aiChatUpdate);

      textToSpeech(response, aiChatUpdate.length - 1);
      setPlayingMessageIndex(chat.length);

      //The next lines saves this interaction to the localStorage such that it can get retrieved later.
      //First I need to generate a title by doing another request to ChatGPT
      const newUserMessage = { role: "user", content: generatedPrompt };
      const newAssistantMessage = { role: "assistant", content: response };


      const chatData = JSON.parse(localStorage.getItem('chatData')) || {};

      if (!titleCurrentChat) {
        let test = [...aiChatUpdate, { role: "system", content: "Summarize the past chats by creating a title. Do not use more than 45 characters in your answer. If this has been done already use the same title." }];
        let titleForChat = await sendChatGptRequest(test);
        console.log("This is the title and only the title: " + titleForChat);

        chatData[titleForChat] = [newUserMessage, newAssistantMessage];
        setTitleCurrentChat(titleForChat);
      } else {
        //append the new answers to the already existing json entry for this chat
        chatData[titleCurrentChat] = [...(chatData[titleCurrentChat] || []), newUserMessage, newAssistantMessage];
      }
      localStorage.setItem('chatData', JSON.stringify(chatData));

    } else {
      console.log("No request got sent to ChatGPT");
    }
  }

  function viewPastChats() {
    setInMainMenu(false);
    setViewHistory(true);
  }

  function createNewChat() {
    setInMainMenu(false);
    setViewHistory(false);
    setTitleCurrentChat('');
    setChat([{ role: "system", content: "You are a helpful assistant. You get prompts which get generated by speech input through a microphone." }]);

    // Need to wait for the site to get rendered until the focus happens.
    setTimeout(() => {
      speakInPromptBtnRef.current.focus();
    }, 20);
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

  const [isSmallScreen, setIsSmallScreen] = useState(window.innerWidth < 630);

  useEffect(() => {
    const checkSize = () => {
      setIsSmallScreen(window.innerWidth < 630);
    };

    window.addEventListener('resize', checkSize);

    return () => window.removeEventListener('resize', checkSize);
  }, []);


  return (
    <div className="App">
      {audioEnabled && (<div className="sidebar-mobile">
        <MdChat className='chat-icon'/>
        <ChatListMobile />
      </div>)}
      {audioEnabled && (<div className="sidebar">
        <h1>Navigation</h1>
        <p>These are all the past chats.</p>
        <ChatList />
      </div>)}
      {isRecording && (<div className='recording-sign' aria-hidden='true'><MdMicNone className='microphone-icon' /></div>)}
      <div className='main-content'>
        <header className="App-header">
          {!audioEnabled && (<h1>ChatGPT Voice Assistant</h1>)}
          {audioEnabled && (<h1>ChatGPT Voice Assistant</h1>)}
          {/*<button style={{ height: "50px", width: "50px", backgroundColor: "red" }} onClick={inputSpeechFunction}></button>*/}
          {audioEnabled && !viewHistory && (<h2 className='instruction-header'>To create a prompt, press the second button below and start speaking. Wait for the response to speak.</h2>)}
        </header>
        {inMainMenu && (
          <div className='App-body'>
            <button className='app-button create-chat'
              onClick={createNewChat}
            >
              Create a new chat
            </button>
            <button className='app-button view-history'
              onClick={viewPastChats}
            >
              View Chat History
            </button>
          </div>
        )}
        {viewHistory && !inMainMenu && (
          <div className='App-body'>
            {/*<button className='app-button main-menu'
              disabled={isPlaying || isRecording}
              onClick={() => setInMainMenu(true)}
            >
              Go Back To Main Menu
        </button>*/}
            <h2>These are all the past chats.</h2>
            <ChatList />
          </div>
        )}
        {!audioEnabled && !viewHistory && !inMainMenu && !micAccessDenied && (<div className='App-body'>
          <h2>Please press the button below and allow microphone access when prompted.</h2>
          <button
            className='app-button start-button'
            onClick={toggleAudio}>
            Start Application
          </button>
        </div>)}
        {micAccessDenied && (
          <div className='App-body'>
            <h3>Microphone Access has been denied. Please refresh the page and allow access.</h3>
            <button className='app-button' onClick={() => window.location.reload()}>Refresh page</button>
          </div>
        )}
        {audioEnabled && !viewHistory && !inMainMenu &&
          (<div className='App-body'>
            {/*<button className='app-button main-menu'
              onClick={() => setInMainMenu(true)}
              disabled={isPlaying || isRecording}
              tabIndex={1}
            >
              Menu Overview
            </button>*/}
            {isSmallScreen &&
            <button className='app-button create-chat' tabIndex={1}
              onClick={createNewChat}
            >
              Create a new chat
            </button>}
            {!isSmallScreen && (<button className='app-button create-chat'
              onClick={createNewChat}
            >
              Create a new chat
            </button>)}
            {isSmallScreen && inMainMenu && (<button className='app-button create-chat'
              onClick={createNewChat}
            >
              Create a new chat
            </button>)}
            <button
              className='app-button speak-in-button'
              onClick={handleClick}
              disabled={isPlaying || isRecording}
              ref={speakInPromptBtnRef}
              tabIndex={2}
            >
              Speak in your prompt
            </button>
            {/*
          <button
            className='app-button play-response-button'
            onClick={() => textToSpeech(responseData, chat.length - 1)}
            disabled={isPlaying}
            tabIndex={2}
          >
            Play last ChatGPT response
          </button>
          */}
            <button disabled={chat.length < 4} className='app-button play-response-button' onClick={toggleChatExpansion} aria-label={isChatExpanded ? "Collapse Chat" : "Expand Chat"} tabIndex={3}>
              {isChatExpanded ? "Collapse Chat" : "Expand Chat"}
            </button>
            {/* Check if it is good to place the button here */}
            <div className='chat'>
              <h1 style={{alignSelf: 'center'}}>Chat</h1>
              <div className='header-chat'>
                <h3>Prompt:</h3>
                <h3>Answer from ChatGPT:</h3>
              </div>
              <div className='content-chat'>
                {chat.map((message, index) => (
                  <ChatMessage index={index} key={index} role={message.role} content={message.content} playingMessageIndex={playingMessageIndex} isPlaying={isPlaying} isPaused={isPaused} />
                ))}
              </div>
            </div>
          </div>)}
        <footer className='App-footer'>
          <p>Current Version: {packagejson.version}</p>
        </footer>
      </div>
    </div>
  );
}

export default App;
