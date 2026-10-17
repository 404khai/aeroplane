import {
  Cancel01Icon,
  CheckmarkCircle02Icon
} from "@hugeicons/core-free-icons";
import { useEffect, useRef, type FormEvent } from "react";
import { AppIcon, FieldLabel, FormInput, shellButton } from "../ui/primitives";
import type {
  AiProviderConnection,
  AiProviderCredentials,
  AiProviderDefinition
} from "./ai-settings-data";

function savedKeyLabel(keySuffix: string) {
  return keySuffix ? `Ending in ${keySuffix}` : "Saved";
}

const selectClass =
  "h-11 w-full border border-zinc-700 bg-zinc-900 px-3 text-sm text-zinc-100 outline-none transition focus:border-[#4FB8B2]/60";

export function AiProviderForm({
  provider,
  values,
  connection,
  error,
  busy = false,
  onChange,
  onSave,
  onCancel
}: {
  provider: AiProviderDefinition;
  values: AiProviderCredentials;
  connection: AiProviderConnection;
  error: string;
  busy?: boolean;
  onChange: (values: AiProviderCredentials) => void;
  onSave: () => void;
  onCancel: () => void;
}) {
  const apiKeyInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!connection.connected || values.apiKey) return;

    const clearAutofilledKey = () => {
      if (apiKeyInputRef.current?.value) {
        apiKeyInputRef.current.value = "";
      }
    };

    clearAutofilledKey();
    const animationFrame = window.requestAnimationFrame(clearAutofilledKey);
    const timeout = window.setTimeout(clearAutofilledKey, 250);

    return () => {
      window.cancelAnimationFrame(animationFrame);
      window.clearTimeout(timeout);
    };
  }, [connection.connected, provider.id, values.apiKey]);

  function saveCredentials(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    onSave();
  }

  const selectedModel = values.selectedModel || connection.selectedModel || provider.models[0]?.id || "";

  return (
    <form onSubmit={saveCredentials} className="space-y-4 border border-zinc-800 bg-zinc-950/45 p-5">
      <div className="flex items-start gap-3">
        <div className="grid h-11 w-11 shrink-0 place-items-center border border-zinc-800 bg-zinc-950/55">
          <img src={provider.logoUrl} alt="" className="max-h-7 max-w-8 object-contain" />
        </div>
        <div>
          <h3 className="font-hero text-lg tracking-tight text-zinc-100">{connection.connected ? `Edit ${provider.name}` : `Connect ${provider.name}`}</h3>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <FieldLabel>API key</FieldLabel>
          <FormInput
            ref={apiKeyInputRef}
            type="password"
            name={`ai-api-key-${provider.id}-replacement`}
            value={values.apiKey}
            onChange={(event) => onChange({ ...values, apiKey: event.target.value })}
            placeholder={connection.connected ? `${savedKeyLabel(connection.keySuffix)}. Enter a new key to replace it.` : provider.apiKeyPlaceholder}
            required={!connection.connected}
            autoComplete="new-password"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            data-1p-ignore="true"
            data-form-type="other"
            data-lpignore="true"
          />
        </div>
        <div>
          <FieldLabel>Model</FieldLabel>
          <select
            value={selectedModel}
            className={selectClass}
            onChange={(event) => onChange({ ...values, selectedModel: event.target.value })}
          >
            {provider.models.map((model) => (
              <option key={model.id} value={model.id}>
                {model.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {error ? <div className="border border-rose-500/35 bg-rose-950/25 px-3 py-2 font-mono text-[10px] text-rose-200">{error}</div> : null}

      <div className="flex flex-wrap items-center gap-2">
        <button type="submit" className={shellButton("primary")} disabled={busy}>
          <AppIcon icon={CheckmarkCircle02Icon} size={15} />
          {busy ? "Saving..." : "Save"}
        </button>
        {connection.connected ? (
          <button type="button" className={shellButton("ghost")} onClick={onCancel} disabled={busy}>
            <AppIcon icon={Cancel01Icon} size={15} />
            Cancel
          </button>
        ) : null}
      </div>
    </form>
  );
}
