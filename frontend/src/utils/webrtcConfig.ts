// STUN discovers reflexive candidates for a direct P2P link (works when
// both devices can reach each other). The TURN server on the VPS relays
// the media when a direct link isn't possible - the doorbell on mobile
// data, the resident away from home, symmetric NAT, etc. Without TURN the
// call would sit forever on "Conectando...".
//
// The TURN credential is a static long-term user; it ships in the client
// bundle. coturn on the VPS limits abuse via per-user/total quotas, a
// small relay port range, and denied-peer-ip rules for private networks.
export const ICE_SERVERS: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    {
      urls: [
        'turn:184.107.106.222:3478?transport=udp',
        'turn:184.107.106.222:3478?transport=tcp',
      ],
      username: 'campainha',
      credential: '5bce242e7b7ed58ced6a0a6621d36aea',
    },
  ],
};
