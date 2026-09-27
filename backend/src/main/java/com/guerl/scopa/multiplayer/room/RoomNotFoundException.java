package com.guerl.scopa.multiplayer.room;

public class RoomNotFoundException extends RoomException {

    public RoomNotFoundException(String roomCode) {
        super("Room " + roomCode + " was not found");
    }
}
