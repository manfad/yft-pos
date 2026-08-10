<script setup lang="ts">
import { ref, watch } from "vue";
import { getRepo } from "../db";
import { parseRecipients, SETTING_KEYS } from "../settings";
import { useUi } from "../stores/ui";
import SelectInput from "./SelectInput.vue";
import TextInput from "./TextInput.vue";
import PinDialog from "./PinDialog.vue";

// PIN-gated device settings: where the daily report goes (list of HQ emails),
// the confirmation PIN, and the receipt paper width — stored in the DB
// `settings` table, read by the Electron main process to send the outbox.
// The sender account (SMTP_USER/SMTP_PASS) lives in a .env file on the till.

const props = defineProps<{ open: boolean }>();
const emit = defineEmits<{ close: [] }>();

const ui = useUi();
const unlocked = ref(false);

const recipients = ref("");
const pin = ref("");
const paperWidth = ref<number>(80);
const sender = ref<string | null>(null);
const senderConfigured = ref<boolean | null>(null);
const paperOptions = [
  { value: 80, label: "80 mm roll" },
  { value: 58, label: "58 mm roll" },
];

watch(
  () => props.open,
  async (o) => {
    unlocked.value = false;
    if (!o) return;
    const repo = await getRepo();
    recipients.value =
      (await repo.getSetting(SETTING_KEYS.recipients)) ??
      (await repo.getSetting(SETTING_KEYS.recipient)) ??
      "";
    pin.value = (await repo.getSetting(SETTING_KEYS.pin)) ?? "1234";
    const w = Number(await repo.getSetting(SETTING_KEYS.paperWidthMm));
    paperWidth.value = w === 58 ? 58 : 80;
    const config = await window.mailer?.config?.().catch(() => null);
    sender.value = config?.user ?? null;
    senderConfigured.value = config ? config.hasCredentials : null;
  },
);

async function save(): Promise<void> {
  const newPin = pin.value.trim();
  if (newPin && !/^\d{4,8}$/.test(newPin)) {
    ui.showToast("PIN must be 4–8 digits");
    return;
  }
  const list = parseRecipients(recipients.value);
  if (recipients.value.trim() && list.length === 0) {
    ui.showToast("No valid email in the recipient list");
    return;
  }
  const repo = await getRepo();
  await repo.setSetting(SETTING_KEYS.recipients, list.join("\n"));
  if (newPin) await repo.setSetting(SETTING_KEYS.pin, newPin);
  await repo.setSetting(SETTING_KEYS.paperWidthMm, String(paperWidth.value));
  ui.showToast("Settings saved");
  emit("close");
}
</script>

<template>
  <PinDialog
    :open="open && !unlocked"
    title="Settings — enter PIN"
    @ok="unlocked = true"
    @close="$emit('close')"
  />

  <div
    v-if="open && unlocked"
    class="fixed inset-0 bg-[rgba(44,38,32,.5)] flex items-center justify-center p-24px z-90"
    @click.self="$emit('close')"
  >
    <div class="w-520px max-w-full bg-surface rounded-26px shadow-[0_22px_64px_rgba(0,0,0,.32)] overflow-auto" style="max-height: 92vh">
      <div class="px-26px pt-24px pb-16px border-b-2 border-borderSoft">
        <div class="text-22px font-800">Settings</div>
        <div class="text-14px font-700 text-muted">Daily report email, PIN and printer.</div>
      </div>

      <div class="px-26px py-20px flex flex-col gap-16px">
        <label class="flex flex-col gap-5px text-13px font-700 text-muted">
          HQ emails (report goes TO — one per line)
          <textarea
            v-model="recipients"
            rows="3"
            title="HQ email addresses, one per line"
            placeholder="hq@example.com&#10;boss@example.com"
            class="w-full px-14px py-10px rounded-12px border-2 border-border bg-white text-16px font-700 text-ink outline-none focus:border-ink resize-y"
          ></textarea>
        </label>
        <div class="text-13px font-700 text-muted">
          <template v-if="senderConfigured === null">
            Sender account: configured via the .env file on the till (SMTP_USER / SMTP_PASS).
          </template>
          <template v-else-if="senderConfigured">
            Sender account: {{ sender }} ✓
          </template>
          <template v-else>
            Sender account not set — add SMTP_USER and SMTP_PASS to the .env file, then restart.
          </template>
        </div>
        <div class="grid grid-cols-2 gap-14px">
          <label class="flex flex-col gap-5px text-13px font-700 text-muted">
            PIN (void / reopen / settings)
            <TextInput v-model="pin" title="PIN (4–8 digits)" placeholder="1234" />
          </label>
          <label class="flex flex-col gap-5px text-13px font-700 text-muted">
            Receipt paper
            <SelectInput v-model="paperWidth" :options="paperOptions" />
          </label>
        </div>
      </div>

      <div class="px-26px pb-24px grid grid-cols-2 gap-12px">
        <button
          class="h-56px rounded-16px border-2 border-border bg-white text-17px font-800 text-muted cursor-pointer press"
          @click="$emit('close')"
        >Cancel</button>
        <button class="btn-pay h-56px text-19px" @click="save">Save</button>
      </div>
    </div>
  </div>
</template>
