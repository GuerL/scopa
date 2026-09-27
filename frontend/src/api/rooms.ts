export type PlayerSnapshot = {
  playerId: string;
  displayName: string;
  host: boolean;
  ready: boolean;
  connected: boolean;
};

export type ScopaSuit = 'GOLD' | 'CUPS' | 'SWORDS' | 'CLUBS';

export type ScopaCard = {
  id: string;
  suit: ScopaSuit;
  value: number;
};

export type ScopaPlayerPublicSnapshot = {
  playerId: string;
  handCount: number;
  capturedCount: number;
  scopasThisRound: number;
  roundPoints: number;
  totalPoints: number;
  roundAcknowledged: boolean;
  rematchRequested: boolean;
};

export type ScopaCaptureOption = {
  handCardId: string;
  tableCardIds: string[];
};

export type ScopaScoreLine = {
  label: string;
  leftPoints: number;
  rightPoints: number;
  leftDetail: string;
  rightDetail: string;
};

export type ScopaRoundResult = {
  leftPlayerId: string;
  rightPlayerId: string;
  lines: ScopaScoreLine[];
  leftRoundPoints: number;
  rightRoundPoints: number;
  leftTotalPoints: number;
  rightTotalPoints: number;
};

export type ScopaGameSnapshot = {
  status: 'ACTIVE' | 'ROUND_FINISHED' | 'MATCH_FINISHED';
  roundNumber: number;
  tableCards: ScopaCard[];
  hand: ScopaCard[];
  possibleCaptures: ScopaCaptureOption[];
  players: ScopaPlayerPublicSnapshot[];
  currentPlayerId: string | null;
  startingPlayerId: string | null;
  lastCapturingPlayerId: string | null;
  winnerPlayerId: string | null;
  deckRemaining: number;
  roundResult: ScopaRoundResult | null;
  lastEvent: string | null;
};

export type RoomSnapshot = {
  roomCode: string;
  hostPlayerId: string;
  players: PlayerSnapshot[];
  createdAt: string;
  status: 'LOBBY' | 'IN_GAME' | 'MATCH_FINISHED';
  game: ScopaGameSnapshot | null;
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

export async function getGameRoom(roomCode: string, playerId: string, sessionToken: string): Promise<RoomSnapshot> {
  const params = new URLSearchParams({ playerId, sessionToken });
  return request<RoomSnapshot>(`/api/rooms/${encodeURIComponent(roomCode)}/game?${params}`);
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

export async function startGame(roomCode: string, playerId: string, sessionToken: string): Promise<RoomSnapshot> {
  return playerAction(`/api/rooms/${encodeURIComponent(roomCode)}/game/start`, playerId, sessionToken);
}

export async function playCard(
  roomCode: string,
  playerId: string,
  sessionToken: string,
  cardId: string,
  captureCardIds: string[],
): Promise<RoomSnapshot> {
  return request<RoomSnapshot>(`/api/rooms/${encodeURIComponent(roomCode)}/game/play`, {
    method: 'POST',
    body: JSON.stringify({ playerId, sessionToken, cardId, captureCardIds }),
  });
}

export async function nextRound(roomCode: string, playerId: string, sessionToken: string): Promise<RoomSnapshot> {
  return playerAction(`/api/rooms/${encodeURIComponent(roomCode)}/game/next-round`, playerId, sessionToken);
}

export async function rematch(roomCode: string, playerId: string, sessionToken: string): Promise<RoomSnapshot> {
  return playerAction(`/api/rooms/${encodeURIComponent(roomCode)}/game/rematch`, playerId, sessionToken);
}

async function playerAction(path: string, playerId: string, sessionToken: string): Promise<RoomSnapshot> {
  return request<RoomSnapshot>(path, {
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
