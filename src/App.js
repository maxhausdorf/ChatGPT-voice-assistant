import './App.css';
import React, { useEffect, useRef, useState } from 'react';
import { OpenAIClient } from '@azure/openai';
import { AzureKeyCredential } from '@azure/openai';
import packagejson from '../package.json';
import { MdPlayCircleOutline, MdOutlinePauseCircleOutline, MdOutlinePanoramaFishEye, MdPlayArrow, MdRemove, MdMicNone } from "react-icons/md";



function App() {

  const [lastPrompt, setLastPrompt] = useState('')
  const [responseData, setResponseData] = useState(null);
  const [chat, setChat] = useState([{ role: "system", content: "You are a helpful assistant. You get prompts which get generated by speech input through a microphone. Your responses must never be longer than 100 words." }]);
  const [isRecording, setIsRecording] = useState(false);
  const [viewHistory, setViewHistory] = useState(false);
  const [titleCurrentChat, setTitleCurrentChat] = useState('');
  const [inMainMenu, setInMainMenu] = useState(false);
  const [isChatExpanded, setIsChatExpanded] = useState(null); // TO DO: if there is only one chat visible, no dropdown/summary is needed to display
  const [playingMessageIndex, setPlayingMessageIndex] = useState(null);


  async function sendChatGptRequest(chat) {

    const client = new OpenAIClient(process.env.REACT_APP_AZURE_OPENAI_ENDPOINT, new AzureKeyCredential(process.env.REACT_APP_AZURE_OPENAI_KEY));
    const deploymentId = "gpt35";

    const options = {
      maxTokens: 100
    }

    const result = await client.getChatCompletions(deploymentId, chat, options);
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

      speechConfig.setProperty("SpeechServiceConnection_InitialSilenceTimeoutMs", "8000"); //How long can you be silent at the beginnig until an error occurs. Does not really need to get adapted, default is at about 5000ms
      //speechConfig.setProperty("SpeechServiceConnection_EndSilenceTimeoutMs", "1000000"); //How long it should continue to record speech after input. Adapting value does not change anything - open issue for microsoft

      //speechConfig.setProperty("Speech_SegmentationSilenceTimeoutMs", "8000"); //Value change doesn't do anything except set it to 0.

      const audioConfig = sdk.AudioConfig.fromDefaultMicrophoneInput();
      const recognizer = new sdk.SpeechRecognizer(speechConfig, audioConfig);

      setResponseData('speak into your microphone...')

      recognizer.recognizeOnceAsync(result => {
        if (result.reason === sdk.ResultReason.RecognizedSpeech) {
          //console.log(`RECOGNIZED PROMPT: Text=${result.text}`)
          setLastPrompt(result.text);
          resolve(result.text);
        } else {
          const errorMessage = 'ERROR: Speech could not be recognized. Wait for the audio signal to finish and start speaking.';
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
  const chatGPTVoiceAssistantRef = useRef(null);

  useEffect(() => {
    if (audioEnabled && chatGPTVoiceAssistantRef.current) {
      /*setTimeout(() => {
        chatGPTVoiceAssistantRef.current.focus();
      }, 20);*/
      chatGPTVoiceAssistantRef.current.focus();
    }
  }, [audioEnabled]);

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
      if (isPaused && !isRecording) {
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
          <h2 tabIndex={tabIndex2}>{`Prompt ${pairIndex} ${content}`}</h2>
          {/*<p aria-label='user message' tabIndex={tabIndex3}>{content}</p>*/}
          <div className='audio-controls'>
            {(index === playingMessageIndex) && isPaused && (<button className='resume-button-user' aria-label={`Resume Reading aloud Prompt ${pairIndex}`} tabIndex={tabIndex6} role='button' onClick={() => (resumeAudio())} ref={resumeButtonRef}>
              <MdOutlinePanoramaFishEye className='circle-icon' />
              <MdPlayArrow className='play-icon' />
              <MdRemove className='bar-icon' />
            </button>)}
            {!isPlaying && (<button className='audio-control-button-user' aria-label={`Read aloud Prompt ${pairIndex} `} tabIndex={tabIndex4} role='button' style={{ marginTop: "10px", fontSize: '40px' }} onClick={() => (textToSpeech(content, index))} ><MdPlayCircleOutline /></button>)}
            {(index === playingMessageIndex) && isPlaying &&
              (<button className='audio-control-button-user'
                aria-label={`Pause Reading aloud Prompt ${pairIndex}`}
                tabIndex={tabIndex5}
                role='button'
                style={{ marginTop: "10px", fontSize: '40px' }}
                onClick={() => (pauseAudio())}
                ref={pauseButtonRef}
              >
                <MdOutlinePauseCircleOutline />
              </button>
              )}

            <button className='audio-control-button-user' style={{ marginTop: "10px", fontSize: '40px', color: 'black', opacity: '0.0' }} tabIndex={-1} aria-hidden="true"><MdPlayCircleOutline /></button> {/* This element is only here to keep the container from collapsing */}
          </div>
          {/*<p>{content}</p>*/}
        </div>
      )
    } else if (role === "assistant") {
      return (
        <div className='chat-ai'>
          {/*  aria-label='chat message' tabIndex={tabIndex1}  */}
          <h2 tabIndex={tabIndex2}>{`Answer ${pairIndex}`}
            {/*<p aria-label='assistant response' tabIndex={tabIndex3}>{content}</p>*/}
            <div className='audio-controls'>
              <button className='audio-control-button-ai' style={{ marginTop: "10px", fontSize: '40px', color: 'white', opacity: '0.0' }} tabIndex={-1} aria-hidden="true"><MdPlayCircleOutline /></button> {/* This element is only here to keep the container from collapsing */}
              {(index === playingMessageIndex) && isPaused && (<button className='resume-button-ai' aria-label={`Resume Reading aloud Response ${pairIndex}`} tabIndex={tabIndex6} role='button' onClick={() => (resumeAudio())} ref={resumeButtonRef}>
                <MdOutlinePanoramaFishEye className='circle-icon' />
                <MdPlayArrow className='play-icon' />
                <MdRemove className='bar-icon' />
              </button>)}
              {!isPlaying && (<button className='audio-control-button-ai' aria-label={`Read aloud Response ${pairIndex}`} tabIndex={tabIndex4} role='button' style={{ marginTop: "10px", fontSize: '40px' }} onClick={() => (textToSpeech(content, index))} ><MdPlayCircleOutline /></button>)}
              {(index === playingMessageIndex) && isPlaying &&
                (<button className='audio-control-button-ai'
                  aria-label={`Pause Reading aloud Response ${pairIndex}`}
                  tabIndex={tabIndex5}
                  role='button'
                  style={{ marginTop: "10px", fontSize: '40px' }}
                  onClick={() => (pauseAudio())}
                  ref={pauseButtonRef}
                >
                  <MdOutlinePauseCircleOutline />
                </button>)}
            </div>
          </h2>
          <p>{content}</p>

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

  const firstListItemRef = useRef(null);

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
          <ul>
            <li>
              <button
                ref={index === 0 ? firstListItemRef : null}
                className='app-button go-to-chat-button'
                key={index}
                disabled={isPlaying || isRecording}
                onClick={() => { goToChat(chatName) }}
              >
                {chatName}
              </button>
            </li>
          </ul>
        ))}
      </div>
    )
  }

  function goToChat(chatName) {
    setViewHistory(false);
    setTitleCurrentChat(chatName);
    const chatData = localStorage.getItem('chatData');
    const chatObject = JSON.parse(chatData);
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

  const todayButtonRef = useRef(null);

  function viewPastChats() {
    setInMainMenu(false);
    setViewHistory(true);
    setTimeout(() => {
      if (todayButtonRef.current) {
        todayButtonRef.current.focus();
      }
    }, 20);
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

    async function inputSpeechFunction() {
    //This function only exists because I am not able to input any stuff as speech in the library!
    let generatedPrompt = "Tell me a story."
    let userChatUpdate = await updateChat({ role: "user", content: generatedPrompt });
    console.log("This is the updated chat after the prompt of the user:", userChatUpdate);


    const response = await sendChatGptRequest(userChatUpdate);

    let aiChatUpdate = await updateChat({ role: "assistant", content: response });
    console.log("This is the updated chat after the reply of chatGPT:", aiChatUpdate);

    //requestGotSent = true;
    //console.log(requestGotSent);
    textToSpeech(response);
  }

  //const Collapsible = React.forwardRef(( title, children, defaultOpen, firstChildRef, isAHeader, ref ) => {
  const Collapsible = React.forwardRef(( props, ref ) => {
    const [isOpen, setIsOpen] = useState(props.defaultOpen || false);
    const hasContent = props.children && React.Children.count(props.children) > 0;


    const toggle = () => setIsOpen(!isOpen);

    if (props.isAHeader) {
      return (
        <div>
          <h1>
            <button
              className='app-button'
              onClick={toggle}
              aria-expanded={isOpen}
              aria-label={hasContent ? props.title : `${props.title} (No Chats available at this time)`}
              ref={ref}
            >
              {props.title}
            </button>
          </h1>
          {isOpen && hasContent && <div className='collapsible-content'>
            {props.children}
          </div>}
          {isOpen && !hasContent &&
            <p className='collapsible-content'>No Chats Available</p>

          }
        </div>
      )
    } else {
      return (
        <div>
          <button
            className='app-button'
            onClick={toggle}
            aria-expanded={isOpen}
            aria-label={hasContent ? props.title : `${props.title} (No Chats available at this time)`}
            ref={ref}
          >
            {props.title}
          </button>
          {isOpen && hasContent && <div className='collapsible-content'>
            {props.children}
          </div>}
          {isOpen && !hasContent &&
            <p className='collapsible-content'>No Chats Available</p>

          }
        </div>
      );
    }

  });

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
      {audioEnabled && (<div className="sidebar">
        <h1>Navigation</h1>
        <p>Chat History</p>
        <Collapsible title="Today">
          <ChatList />
        </Collapsible>
        <Collapsible title="Yesterday"></Collapsible>
        <Collapsible title="Last Week"></Collapsible>
        <Collapsible title="Last 30 days"></Collapsible>
      </div>)}
      {isRecording && (<div className='recording-sign' aria-hidden='true'><MdMicNone className='microphone-icon' /></div>)}
      <div className='main-content'>
        <div className="App-header">
          {!audioEnabled && (<h1>ChatGPT Voice Assistant</h1>)}
          {audioEnabled && (
            <div>
              {/*<h1>ChatGPT Voice Assistant</h1>*/}
              {isSmallScreen && (<Collapsible role='navigation' aria-label="ChatGPT main navigation" tabindex="1" title="ChatGPT Voice Assistant" isAHeader={true} ref={chatGPTVoiceAssistantRef}>
                <button className='app-button create-chat'
                  onClick={createNewChat}
                >
                  Create a new chat
                </button>
                <Collapsible title="Chat History">
                  <Collapsible title="Today" ref={todayButtonRef}>
                    <ChatList />
                  </Collapsible>
                  <Collapsible title="Yesterday"></Collapsible>
                  <Collapsible title="Last Week"></Collapsible>
                  <Collapsible title="Last 30 days"></Collapsible>
                  <button className='app-button create-chat'
                    onClick={(() => { localStorage.clear();  })} //TODO: delete chat history and create a new chat
                  >
                    Delete Chat History
                  </button>
                </Collapsible>
              </Collapsible>)}
            </div>
          )}

          <button style={{ height: "50px", width: "50px", backgroundColor: "red" }} onClick={inputSpeechFunction}></button>
        </div>
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
            <button className='app-button main-menu'
              disabled={isPlaying || isRecording}
              onClick={() => setInMainMenu(true)}
            >
              Go Back To Main Menu
            </button>
            <h2>Chat History</h2>
            <Collapsible title="Today" ref={todayButtonRef} firstChildRef={firstListItemRef}>
              <ChatList />
            </Collapsible>
            <Collapsible title="Yesterday"></Collapsible>
            <Collapsible title="Last Week"></Collapsible>
            <Collapsible title="Last 30 days"></Collapsible>
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
            <Collapsible title='Chat Navigation' defaultOpen={true} isAHeader={true}>

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
                Speak in
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
              <button disabled={chat.length < 4} className='app-button play-response-button' onClick={toggleChatExpansion} aria-label={isChatExpanded ? "Collapse Chat" : "Expand Chat"} aria-expanded={isChatExpanded} tabIndex={3}>
                {isChatExpanded ? "Collapse Chat" : "Expand Chat"}
              </button>
            </Collapsible>
            {/* Check if it is good to place the button here */}
            <div className='chat'>
              <div className='header-chat'>
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
