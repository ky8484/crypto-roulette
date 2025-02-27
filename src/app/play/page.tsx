"use client";

import { Sky } from "@react-three/drei";
import { Canvas } from "@react-three/fiber";
import { Physics } from "@react-three/cannon";
import { Environment } from "@/components/Environment";
import { Player } from "@/components/Player";
import { useEffect, useRef, useState, useCallback } from "react";
import { socket } from "@/socket";
import { Text } from "@react-three/drei";
import { ENTRY_FEE, ENTRY_FEE_WITH_ZEROS, NUM_PLAYERS } from "@/constants";
import { Table } from "@/components/Table";
import { useAptosWallet } from "@razorlabs/wallet-kit";
import { abbreviateAddress } from "@/utils";
import { Press_Start_2P, Orbitron } from "next/font/google";
import { Aptos, AptosConfig, Network } from "@aptos-labs/ts-sdk";

const modernFont = Orbitron({
  subsets: ["latin"],
  weight: ["400", "700"],
  display: "block",
});

const bitFont = Press_Start_2P({ subsets: ["latin"], weight: ["400"] });

export default function Home() {
  const TABLE_RADIUS = 8;

  const [roomConnected, setRoomConnected] = useState(false);
  // const [userId, setUserId] = useState("");
  const [roomId, setRoomId] = useState("");
  const [gameStarted, setGameStarted] = useState(false);
  const [roomData, setRoomData] = useState({} as any);
  const [message, setMessage] = useState<string | null>();
  const [decision, setDecision] = useState<string | null>();
  const [consequence, setConsequence] = useState<string | null>();
  const [prevPlayer, setPrevPlayer] = useState();
  const [randomDetonation, setRandomDetonation] = useState(false);
  const [numPlayersToEliminate, setNumPlayersToEliminate] = useState();
  const [isCopied, setIsCopied] = useState(false);

  const remoteRefs = useRef([]); // Reference for the remote
  const userId = useAptosWallet().address;
  const { address, account, signAndSubmitTransaction } = useAptosWallet();

  //1 MOVE
  const gameFundAddress =
    "0x851cfbe389013be02c0c7ecec6f05459be7be20681a311ed96fbff45f2a81c14";
  type Coin = { coin: { value: string } };

  // Setup the client
  const config = new AptosConfig({
    network: Network.CUSTOM,
    fullnode: 'https://aptos.testnet.porto.movementlabs.xyz/v1',
    faucet: 'https://fund.testnet.porto.movementlabs.xyz/',
    indexer: "https://indexer.testnet.porto.movementnetwork.xyz/v1/graphql",
  });
  const controlsRef = useRef();

  const handleUnlock = useCallback(() => {
    if (controlsRef.current) {
      //@ts-ignore
      controlsRef.current.unlock();
    }
  }, []);

  const copyToClipboard = useCallback(
    (event: any) => {
      event.preventDefault();
      event.stopPropagation();
      handleUnlock();
      navigator.clipboard.writeText(roomId).then(
        () => {
          console.log("Room ID copied to clipboard");
          setIsCopied(true);
          setTimeout(() => setIsCopied(false), 2000); // Reset after 2 seconds
        },
        (err) => {
          console.error("Could not copy text: ", err);
        }
      );
    },
    [roomId, handleUnlock]
  );
  const movement = new Aptos(config);

  useEffect(() => {
    const startGame = (data: any) => {
      setGameStarted(true);
      setRoomData(data);
    };

    const turnProcessed = (data: any) => {
      setDecision(null);
      setMessage(null);
      setConsequence(null);
      setRoomData(data);
    };

    const numDecided = (data: any) => {
      setDecision(null);
      setMessage(null);
      setConsequence(null);
      setNumPlayersToEliminate(data);
    };

    const playerJoined = (data: any) => {
      // console.log(data);
      setRoomData(data);
    };

    const turnInit = (data: any) => {
      setDecision(data.decision);
      setPrevPlayer(data.prevPlayer);
    };

    const turnConsequence = (data: any) => {
      setDecision(null);
      setPrevPlayer(data.prevPlayer);
      setConsequence(data.consequence);
    };

    const numStarted = (data: any) => {
      setRandomDetonation(true);
    };

    socket.on("start_game", startGame);
    socket.on("turn_processed", turnProcessed);
    socket.on("num_decided", numDecided);
    socket.on("player_joined", playerJoined);
    socket.on("turn_consequence", turnConsequence);
    socket.on("randomly_detonating_broadcast", numStarted);
    socket.on("turn_init", turnInit);

    return () => {
      socket.off("start_game", startGame);
      socket.off("turn_processed", turnProcessed);
      socket.off("num_decided", numDecided);
    };
  }, []);

  const detonateClicked = async () => {
    socket.emit("turn_played", { choice: "detonate", userId, roomId });
  };

  const passClicked = async () => {
    socket.emit("turn_played", { choice: "pass", userId, roomId });
  };

  const joinClicked = async () => {
    if (userId && roomId) {
      try {
        const pendingTxn = await signAndSubmitTransaction({
          // transaction

          payload: {
            function: "0x1::aptos_account::transfer",
            functionArguments: [gameFundAddress, ENTRY_FEE_WITH_ZEROS],
          },
        });

        if (pendingTxn.status === "Approved") {
        socket.emit("join_room", { userId, roomId });
        setRoomConnected(true);
        }
      } catch (error) {
        alert("Transaction failed, please try again");
      }
    }
  };

  const playerPositions = Array.from(
    { length: roomData.playersArray?.length },
    (_, i) => {
      const angle = (i / roomData.playersArray?.length) * Math.PI * 2;
      return [
        TABLE_RADIUS * Math.cos(angle),
        1,
        TABLE_RADIUS * Math.sin(angle),
      ];
    }
  );

  return (
    <main className="flex min-h-screen flex-col items-center justify-between">
      {roomConnected ? (
        <div className="h-screen w-full">
          {roomData.gameStatus === "waiting" && (
            <div
              className={`${modernFont.className} text-xl tracking-wide absolute z-[100] left-4 top-4`}
            >
              Waiting for {NUM_PLAYERS - roomData.playersArray.length} more
              player{NUM_PLAYERS - roomData.playersArray.length < 2 ? "" : "s"}{" "}
              to join
            </div>
          )}

          <Canvas className="">
            <ambientLight intensity={1} />
            <Physics>
              {playerPositions.map((position, index) => {
                const playerId = roomData.playersArray[index];
                // console.log("player id here is: ", playerId);
                // console.log("user id here is: ", userId);
                // console.log("equality comparison: ", userId == playerId);
                // console.log("ye dekh, ", index, position);

                return (
                  <Player
                    key={playerId}
                    userId={playerId}
                    position={playerPositions[index]}
                    whoseTurn={roomData.whoseTurn}
                    isMe={userId === playerId}
                    remoteRef={remoteRefs.current[playerId]}
                    playerCount={roomData.playersArray.length}
                    playerIndex={index}
                    controlsRef={controlsRef}
                  />
                );
              })}
              <Environment />
              <Table
                radius={TABLE_RADIUS - 1}
                playerCount={roomData.playersArray?.length || 0}
                onDetonate={detonateClicked}
                onPass={passClicked}
                whoseTurn={roomData.whoseTurn}
                playersArray={roomData.playersArray || []}
              />
            </Physics>
          </Canvas>
          <div
            className={`${modernFont.className} text-xl tracking-wide absolute z-[2000] right-4 top-4 flex items-center`}
            style={{ pointerEvents: "none" }}
          >
            <span>Room ID: {roomId}</span>
            <button
              onClick={(e) => {
                e.stopPropagation();
                copyToClipboard(e);
              }}
              className={`ml-2 p-1 ${
                isCopied ? "bg-green-600" : "bg-gray-700 hover:bg-gray-600"
              } rounded transition-colors duration-300`}
              title={isCopied ? "Copied!" : "Copy Room ID"}
              style={{ pointerEvents: "auto" }}
            >
              {isCopied ? (
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-5 w-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 13l4 4L19 7"
                  />
                </svg>
              ) : (
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-5 w-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                  />
                </svg>
              )}
            </button>
          </div>

          {randomDetonation && roomData.gameStatus !== "ended" ? (
            <div className="absolute  bg-yellow-700 px-10 py-3 w-[30rem] rounded-md top-[50%] left-[50%] translate-x-[-50%] translate-y-[-50%] flex flex-col justify-center items-center">
              <div
                className={`flex text-center text-xl tracking-wider ${modernFont.className}`}
              >
                Since none of you are brave enough to detonate, I will do it for
                some of you. <br />
                {numPlayersToEliminate &&
                  `${numPlayersToEliminate} player${
                    numPlayersToEliminate > 1 ? "s" : ""
                  } will be randomly detonated. Start praying.`}
              </div>
            </div>
          ) : message ? (
            <div className="absolute  bg-yellow-700 px-10 py-3 w-max rounded-md top-[50%] left-[50%] translate-x-[-50%] translate-y-[-50%] flex flex-col justify-center items-center">
              <div className={`${bitFont.className}`}>{message}</div>
            </div>
          ) : decision ? (
            <div className="absolute  bg-yellow-700 px-10 py-3 w-max rounded-md top-[50%] left-[50%] translate-x-[-50%] translate-y-[-50%] flex flex-col justify-center items-center">
              <div className={`${bitFont.className}`}>
                {prevPlayer === userId
                  ? "you have"
                  : `${abbreviateAddress(prevPlayer)} has`}{" "}
                chosen to {decision}!
              </div>
            </div>
          ) : consequence ? (
            <div className="absolute  bg-yellow-700 px-10 py-3 w-max rounded-md top-[50%] left-[50%] translate-x-[-50%] translate-y-[-50%] flex flex-col justify-center items-center">
              <div className={`${bitFont.className}`}>
                {prevPlayer === userId
                  ? `you detonated ${
                      consequence === "themself"
                        ? "yourself!"
                        : "everyone else!"
                    }`
                  : `${abbreviateAddress(
                      prevPlayer
                    )} detonated ${consequence}!`}
              </div>
            </div>
          ) : (
            roomData.gameStatus !== "ended" && (
              <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 pointer-events-none">
                <div className="w-2 h-2 rounded-full border-2 border-black bg-white flex items-center justify-center">
                  <div className="w-1 h-1 bg-white rounded-full"></div>
                </div>
              </div>
            )
          )}
        </div>
      ) : (
        <div className="min-h-screen bg-gradient-to-b from-gray-900 to-black flex items-center  w-full justify-center px-4">
          <div className="bg-gray-800 p-8 rounded-lg shadow-2xl max-w-md w-full">
            <h2
              className={`${bitFont.className} text-3xl text-yellow-400 mb-6 text-center`}
            >
              Join a Room
            </h2>

            {/* <div className="mb-6">
              <label
                htmlFor="userId"
                className="block text-sm font-medium text-gray-400 mb-2"
              >
                Your ID
              </label>
              <input
                id="userId"
                type="text"
                className="w-full px-3 py-2 bg-gray-500 cursor-not-allowed text-gray-200 rounded border border-gray-600 focus:border-yellow-500 focus:ring focus:ring-yellow-500 focus:ring-opacity-50"
                value={abbreviateAddress(userId ? userId : "")}
                // value={userId}
                disabled={true}
                // onChange={(event) => setUserId(event.target.value)}
                placeholder="Connected Wallet Address"
              />
            </div> */}

            <div className="mb-9 mt-9">
              <label
                htmlFor="roomId"
                className="block text-sm font-medium text-gray-400 mb-2"
              >
                Room ID
              </label>
              <input
                id="roomId"
                type="text"
                className="w-full px-3 py-2 bg-gray-700 text-white rounded border border-gray-600 focus:border-yellow-500 focus:ring focus:ring-yellow-500 focus:ring-opacity-50"
                value={roomId}
                onChange={(e) => setRoomId(e.target.value)}
                placeholder="Enter Room ID"
              />
            </div>

            <button
              className={`${bitFont.className} w-full px-4 py-3 bg-yellow-500 hover:bg-yellow-700 text-black rounded-lg shadow-lg hover:shadow-xl transition duration-300 ease-in-out transform hover:scale-105`}
              onClick={joinClicked}
            >
              Join ({ENTRY_FEE} MOVE)
            </button>

            <p className="mt-4 text-sm text-gray-500 text-center">
              Enter the Room ID provided by the game host. If you are creating a
              new room, use an ID of your choice.
            </p>
          </div>
        </div>
      )}
      {roomData.gameStatus === "started" ? (
        roomData!.whoseTurn !== userId ? (
          <div
            className={`${modernFont.className} text-xl tracking-wide absolute z-20 left-4 top-4`}
          >
            {abbreviateAddress(roomData.whoseTurn)} is choosing
          </div>
        ) : (
          <div
            className={`${modernFont.className} text-xl tracking-wide absolute z-20 left-4 top-4`}
          >
            Push the <span className="text-[#f75e53]">red</span> button to
            detonate, <span className=" text-[#86d46e]">green</span> to pass
          </div>
        )
      ) : (
        ""
      )}

      {roomData.gameStatus === "ended" ? (
        <div className="absolute  px-10 py-3 w-[40rem] rounded-md top-[50%] left-[50%] translate-x-[-50%] translate-y-[-50%] flex flex-col justify-center items-center">
          <div className="bg-yellow-700 rounded-md px-10 py-3 ">
            <h1 className={`text-4xl text-center ${bitFont.className}`}>
              Game Over
            </h1>
            {roomData.activePlayersArray.length > 0 ? (
              <div className="flex flex-col justify-center  items-center">
                <h2 className={`text-3xl mt-4 mb-3 ${modernFont.className}`}>
                  Winners
                </h2>
                <div
                  className={`${bitFont.className} flex justify-center items-center flex-col gap-1`}
                >
                  {roomData.activePlayersArray.map((winner: any) => (
                    <div
                      className={`${
                        winner === userId &&
                        "text-bold font-bold text-yellow-100 underline"
                      }`}
                      key={winner}
                    >
                      {abbreviateAddress(winner)}
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div>
                <div
                  className={`mt-4 text-xl text-center tracking-wide  ${modernFont.className}`}
                >
                  Everyone was detonated. <br />
                  Should have been more brave.
                </div>
              </div>
            )}
          </div>
          {roomData.activePlayersArray.includes(userId) && (
            <div
              className={`mt-2 text-xl rounded-lg w-[30rem] text-center  justify-center text-black tracking-wider bg-white ${modernFont.className}`}
            >
              Congratulations, you won!{" "}
              <span className=" font-bold">
                {(
                  ((95 / 100) * NUM_PLAYERS * ENTRY_FEE) /
                  roomData.activePlayersArray.length
                ).toFixed(2)}{" "}
                MOVE
              </span>{" "}
              has been deposited into your wallet!
            </div>
          )}
          <button
            className={`${bitFont.className} mt-4 px-4 py-3 bg-yellow-600 hover:bg-yellow-700 text-white rounded-lg shadow-lg hover:shadow-xl transition duration-300 ease-in-out transform hover:scale-105`}
            onClick={() => (document.location.href = "/play")}
          >
            Play Again
          </button>{" "}
        </div>
      ) : (
        ""
      )}
    </main>
  );
}
