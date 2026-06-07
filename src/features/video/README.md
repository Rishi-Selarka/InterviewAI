# video

Live video & audio for the interview room, powered by **VideoSDK.live**.

Implemented (Milestone 3):
- `server/videosdk.ts` — server-only: signs short-lived HS256 auth tokens and
  maps each interview `roomId` to a stable VideoSDK meeting id (create-once +
  cache). API key/secret never reach the browser.
- `app/api/videosdk-token/route.ts` — returns `{ token, meetingId }` for a room.
- `VideoPanel.tsx` — fetches the token, mounts `MeetingProvider`, auto-joins.
- `MeetingView.tsx` — custom layout: participant tiles + mic/camera/leave
  controls, plus connecting / waiting / rejoin states.
- `ParticipantTile.tsx` — builds tiles from the raw `webcamStream`/`micStream`
  tracks (custom UI, not a prebuilt player).

The whole panel is loaded via `next/dynamic({ ssr: false })` from
`src/features/room/RoomLayout.tsx` because the SDK touches `self` at import time.

Note: the LOCAL camera track is surfaced via `onLocalWebcamTrack` (kept as a plain
`MediaStreamTrack`) so `src/features/proctoring` can later read frames for
MediaPipe look-away detection without re-acquiring the camera.
