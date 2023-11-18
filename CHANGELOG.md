Use the following notation:
## Added (New features or additions.) ##Changed (Updates or modifications.) ##Fixed (Bug fixes) ##Removed (Features or code that was removed.)



## [0.1.1] - 2023-10-31
### Added
- Changelog
### Changed
- Input comes from microphone again to test if it works in safari now.

## [0.1.2] - 2023-10-31
### Changed
- To play the response generated by ChatGPT, a button needs to be pressed.
This is a first step to find the issue to why the response is not read (after generating) in safari but only chrome.

## [1.0.0] - 2023-10-31
### Changed
- Commented out unnecessary UI elements only needed for development.
- Adapted introductional text to introduce the 'play' button for the ChatGPT response.
- Color of buttons

## [1.0.1] - 2023-11-03
### Changed
- Renamed prompt input button

## [1.0.2] - 2023-11-03
### Changed
- Bugfix

## [1.1.0] - 2023-11-04
### Changed
- Major bugfix. It is now not possible anymore to click on the 'speak in prompt' or 'play chatgpt response' button
if there is already a speech output happening. This was done by using the onAudioStart and onAudioEnd property. Hurray!

## [1.2.0] - 2023-11-05
### Changed
- Prompts and answers are currently visible again. Will get transformed into a chat into the future.
### Added
- There is now audio feedback when the button "Speak in your prompt" gets pressed. When the speech got transformed into text, there is audio feedback again. The notification sounds are different, the first one goes from low pitch to high, the other one from high to low.

## [1.2.1] - 2023-11-05
### Changed
- Color buttons are now red and blue.

## [2.0.0] - 2023-11-05
### Changed
- New Design and construction of the application. Included division into header, body and footer. In the header is a simple instruction. The body includes the two buttons and the chat. The footer currently only includes the versioning.

## [2.0.1] - 2023-11-06
### Changed
- Adapted width of prompt and answer containers to break paragraphs sooner.

## [2.1.0] - 2023-11-06
### Changed
- Changed the default voice to have a higher pitched male voice.

## [2.1.1] - 2023-11-06
### Changed
- Reverted voice change because of performance reasons.

## [3.0.0] - 2023-11-06
### Added
- The application now has access to all past chats. (Up until the browser window gets refreshed).

## [3.1.0] - 2023-11-06
### Added
- All past chats now get displayed.

## [4.0.0] - 2023-11-08
### Added
- Prompts and answers can now each get played, paused and resumed. Changed the general play chatgpt response button to "Play LAST ChatGPT response".

## [4.1.0] - 2023-11-08
### Changed
- Buttons now do not get disabled but get removed such that ScreenReader does not read them.

## [4.1.1] - 2023-11-08
### Changed
- Removed bug. isPaused gets set to false if "play prompt" gets pressed.

## [4.1.2] - 2023-11-08
### Changed
- Changed the css styles of the new buttons.

## [4.1.3] - 2023-11-09
### Changed
- Changed Index Name in <title> element to ChatGPT-voice-assistant

## [4.1.4] - 2023-11-09
### Changed
- Started adapting the header structure

## [4.1.5] - 2023-13-09
### Changed
- Bugfix: Numbering of prompts and answers was wrong

## [4.1.6] - 2023-13-09
### Changed
- Autoplay: for testing purposes this version will include autoplay after answer generation. Will restore if this feature does not work during testing.

## [4.1.7] - 2023-15-09
### Changed
- Bugfix: During a recording the "Speak in prompt" button now gets disabled.

## [4.1.8] - 2023-17-09
### Added
- A focused element now has a blue border.
### Changed
- After a prompt has been read, the focus automatically switches to the "Speak in your prompt" button.

## [4.1.9] - 2023-17-09
### Changed
- Introduced some major design changes:
    - Included chat bubbles for the user and GPT and gave it a "chat-like" feel
    - Support even better response for mobile view

## [4.2.0] - 2023-17-09
### Added
- Replaced the buttons with icons

## [5.0.0] - 2023-18-09
### Changed
- Answers now also get automatically played on mobile.
(This got achieved by including the playing of a silent audio file. It gets played directly each time the "Speak in your prompt" button gets pressed.)
(During testing this worked 99% of the time, rarely the text did not get played automatically. I suspect this has something to do with no implementation of a "OnTouch" method.
TODO: Further inspect this for later.)
- Added a welcoming screen with a button. Upon pressing the access for the microphone gets requested to enhance the user experience.
TODO: What happens if the user says no with the microphone?? Handle this case as well!!
If the user grants access all the other elements also get rendered.
TODO: Precisely test this with VoiceOver!!