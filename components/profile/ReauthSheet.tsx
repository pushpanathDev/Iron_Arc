import type { ReauthState } from "../../hooks/useAccountActions";
import { Button } from "../ui/Button";
import { Sheet } from "../ui/Sheet";
import { TextField } from "../ui/TextField";

/** Firebase asks for a recent sign-in before deleting an email account. */
export function ReauthSheet({ reauth, deleting }: { reauth: ReauthState; deleting: boolean }) {
  return (
    <Sheet visible={reauth.open} onClose={deleting ? undefined : reauth.cancel} title="Confirm your password" subtitle="For your security, sign in again before deleting this account.">
      <TextField label="Password" variant="password" value={reauth.password} onChangeText={reauth.setPassword} autoCapitalize="none" autoCorrect={false} error={reauth.error} autoFocus />
      <Button title="Delete account" icon="trash-outline" variant="dangerTonal" onPress={() => void reauth.confirm()} loading={deleting} disabled={deleting || !reauth.password} fullWidth />
    </Sheet>
  );
}
