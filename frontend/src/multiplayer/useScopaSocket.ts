export function createScopaSocket(roomCode: string, playerId: string, sessionToken: string): WebSocket {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const params = new URLSearchParams({ playerId, sessionToken });
  return new WebSocket(
    `${protocol}//${window.location.host}/ws/rooms/${encodeURIComponent(roomCode)}?${params.toString()}`,
  );
}
