// LAN-only calls for now (both devices on the same home Wi-Fi) - a free
// public STUN server is enough to discover reflexive candidates. No TURN
// relay configured, so a call placed while the resident is away from
// home won't connect.
export const ICE_SERVERS: RTCConfiguration = {
  iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
};
