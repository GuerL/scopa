export type PlayerSnapshot = {
  playerId: string;
  displayName: string;
  host: boolean;
  ready: boolean;
  connected: boolean;
};

export type RoomSnapshot = {
  roomCode: string;
  hostPlayerId: string;
  players: PlayerSnapshot[];
  createdAt: string;
  status: 'LOBBY';
};

export type RoomSession = {
  roomCode: string;
  playerId: string;
  sessionToken: string;
  room: RoomSnapshot;
};

type ApiErrorBody = {
  message?: string;
};

export async function createRoom(displayName: string): Promise<RoomSession> {
  return request<RoomSession>('/api/rooms', {
    method: 'POST',
    body: JSON.stringify({ displayName }),
  });
}

export async function joinRoom(roomCode: string, displayName: string): Promise<RoomSession> {
  return request<RoomSession>(`/api/rooms/${encodeURIComponent(roomCode)}/join`, {
    method: 'POST',
    body: JSON.stringify({ displayName }),
  });
}

export async function getRoom(roomCode: string): Promise<RoomSnapshot> {
  return request<RoomSnapshot>(`/api/rooms/${encodeURIComponent(roomCode)}`);
}

export async function setReady(
  roomCode: string,
  playerId: string,
  sessionToken: string,
  ready: boolean,
): Promise<RoomSnapshot> {
  return request<RoomSnapshot>(`/api/rooms/${encodeURIComponent(roomCode)}/ready`, {
    method: 'POST',
    body: JSON.stringify({ playerId, sessionToken, ready }),
  });
}

export async function leaveRoom(
  roomCode: string,
  playerId: string,
  sessionToken: string,
): Promise<{ roomDeleted: boolean }> {
  return request<{ roomDeleted: boolean }>(`/api/rooms/${encodeURIComponent(roomCode)}/leave`, {
    method: 'POST',
    body: JSON.stringify({ playerId, sessionToken }),
  });
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(path, {
    ...init,
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      ...init.headers,
    },
  });

  if (!response.ok) {
    let message = `Request failed with ${response.status}`;
    try {
      const body = (await response.json()) as ApiErrorBody;
      message = body.message ?? message;
    } catch {
      // Keep the HTTP status fallback.
    }
    throw new Error(message);
  }

  return response.json() as Promise<T>;
}
