import { pickForClub } from "@/app/actions";
import { AlbumPicker, type PickerOption } from "@/components/AlbumPicker";

/** Choose the party's album: search, or one from your To listen, then an optional line on why. */
export function ClubPicker({ clubId, week, queued }: { clubId: string; week: "this" | "next"; queued: PickerOption[] }) {
  return (
    <AlbumPicker
      action={pickForClub}
      hidden={{ club_id: clubId, week }}
      submitLabel={week === "next" ? "Pick it for next week" : "Pick it for this week"}
      notePlaceholder="The one I always come back to in November…"
      queued={queued}
    />
  );
}
