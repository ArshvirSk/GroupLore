"use client";

import { Badge, Button, Card } from "@/components/ui";
import { Icon } from "@/components/ui/Icon";
import type { RoomView } from "@/stores/roomStore";

export default function TeamAssignment({
  room,
  act,
}: {
  room: RoomView;
  act: (action: string, data?: Record<string, unknown>) => void;
}) {
  const game = room.catalog.find((entry) => entry.id === room.gameId);
  const meta = game?.teams;
  const teams = room.teams || [];
  const players = new Map(room.players.map((player) => [player.id, player]));
  const smallest = teams.length ? Math.min(...teams.map((team) => team.playerIds.length)) : 0;
  const largest = teams.length ? Math.max(...teams.map((team) => team.playerIds.length)) : 0;
  const ready =
    Boolean(meta) &&
    teams.length === (meta?.count || 0) &&
    smallest >= (meta?.minPerTeam || 1) &&
    largest - smallest <= 1;

  return (
    <div className="space-y-4">
      <Card className="p-5">
        <div className="flex items-start gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px] bg-primary-soft text-primary">
            <Icon name="users" className="h-5 w-5" />
          </span>
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-muted">
              Team setup
            </p>
            <h2 className="font-display text-xl font-semibold text-ink">
              {game?.name || "Team game"}
            </h2>
            <p className="mt-1 text-sm font-medium text-muted">
              Every team needs {meta?.minPerTeam || 2} players and sizes can differ by at most one.
            </p>
          </div>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {teams.map((team) => (
            <div
              key={team.id}
              className="rounded-2xl border border-border bg-surface-2/40 p-3"
              style={{ borderTopColor: team.color, borderTopWidth: 4 }}
            >
              <div className="flex items-center justify-between gap-2">
                <p className="font-display font-semibold text-ink">{team.name}</p>
                <Badge>{team.playerIds.length} players</Badge>
              </div>
              <div className="mt-2 space-y-1.5">
                {team.playerIds.map((playerId) => {
                  const player = players.get(playerId);
                  if (!player) return null;
                  return (
                    <div
                      key={playerId}
                      className="flex items-center justify-between gap-2 rounded-xl bg-surface px-3 py-2"
                    >
                      <span className="truncate text-sm font-semibold text-ink">
                        {player.name}
                        {playerId === room.you?.id ? " (you)" : ""}
                      </span>
                      {room.you?.isHost && !room.teamsLocked ? (
                        <button
                          type="button"
                          onClick={() =>
                            act("movePlayerTeam", {
                              playerId,
                              teamId: teams.find((item) => item.id !== team.id)?.id,
                            })
                          }
                          className="min-h-8 rounded-full px-2 text-[10px] font-bold uppercase tracking-wide text-muted hover:bg-surface-2 hover:text-ink"
                        >
                          Switch
                        </button>
                      ) : null}
                    </div>
                  );
                })}
                {team.playerIds.length === 0 ? (
                  <p className="px-2 py-2 text-xs font-semibold text-muted">Empty team</p>
                ) : null}
              </div>
            </div>
          ))}
        </div>

        {room.you?.isHost ? (
          <div className="mt-4 flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="secondary"
              disabled={room.teamsLocked}
              onClick={() => act("autoBalanceTeams")}
            >
              <Icon name="shuffle" className="h-4 w-4" /> Auto-balance
            </Button>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => act("lockTeams", { locked: !room.teamsLocked })}
            >
              <Icon name={room.teamsLocked ? "key" : "check"} className="h-4 w-4" />
              {room.teamsLocked ? "Unlock teams" : "Lock teams"}
            </Button>
            <Button
              size="sm"
              disabled={!ready}
              onClick={() => act("start")}
              className="sm:ml-auto"
            >
              Start game <Icon name="arrow-right" className="h-4 w-4" />
            </Button>
          </div>
        ) : (
          <p className="mt-4 rounded-xl bg-surface-2 px-4 py-3 text-sm font-semibold text-muted">
            The host is setting the teams. You can join the room while you wait.
          </p>
        )}

        {!ready ? (
          <p className="mt-3 text-xs font-semibold text-[#B83232]">
            Teams are not ready yet: {teams.length}/{meta?.count || 2} teams, smallest has {smallest}.
          </p>
        ) : null}
      </Card>
    </div>
  );
}
