# YouTube-DWL
- Download any quality video 
- Video + Audio | Video and audio will be merged together
- The uploaded video will be saved in build/Audio

# Help for console
- url: Link to youtube video     | Needed parameter     | Example: https://youtu.be/g_Nf2S6JbOY
- AudioType: Type file           | Default: mp3         | Example: mp4
- NeedVideo: Quality             | Default: AudioOnly   | Example: 1080p

# How to start
- Need FFmpeg and Node.js >=17
- Typescript >= 4.9

1. Build project
   - execute build.bat
   - or tsc -p tsconfig.json
2. Running project
   - execute run.bat
   - or cd build && node -r tsconfig-paths/register src/dwl.js
