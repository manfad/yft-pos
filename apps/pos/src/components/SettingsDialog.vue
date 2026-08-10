<script setup lang="ts">
import { ref, watch } from "vue";
import { getRepo } from "../db";
import { SETTING_KEYS } from "../settings";
import { useUi } from "../stores/ui";
import TextInput from "./TextInput.vue";
import SelectInput from "./SelectInput.vue";
import PinDialog from "./PinDialog.vue";

// PIN-gated device settings: where the daily report goes (HQ email), the
// dedicated Gmail account it is sent from, the confirmation PIN, and the
// receipt paper width. Stored in the DB `settings` table — the Electron main
// process reads the same rows to send the outbox.

const props = defineProps<{ open: boolean }>();
const emit = defineEmits<{ close: [] }>();

const ui = useUi();
const unlocked = ref(false);

const recipient = ref("");
const smtpUser = ref("");
const smtpPass = ref("");
const pin = ref("");
const paperWidth = ref<number>(80);
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
    recipient.value = (await repo.getSetting(SETTING_KEYS.recipient)) ?? "";
    smtpUser.value = (await repo.getSetting(SETTING_KEYS.smtpUser)) ?? "";
    smtpPass.value = (await repo.getSetting(SETTING_KEYS.smtpPass)) ?? "";
    pin.value = (await repo.getSetting(SETTING_KEYS.pin)) ?? "1234";
    const w = Number(await repo.getSetting(SETTING_KEYS.paperWidthMm));
    paperWidth.value = w === 58 ? 58 : 80;
  },
);

async function save(): Promise<void> {
  const newPin = pin.value.trim();
  if (newPin && !/^\d{4,8}$/.test(newPin)) {
    ui.showToast("PIN must be 4–8 digits");
    return;
  }
  const repo = await getRepo();
  await repo.setSetting(SETTING_KEYS.recipient, recipient.value.trim());
  await repo.setSetting(SETTING_KEYS.smtpUser, smtpUser.value.trim());
  await repo.setSetting(SETTING_KEYS.smtpPass, smtpPass.value.trim());
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
          HQ email (report goes TO)
          <TextInput v-model="recipient" title="HQ email address" placeholder="hq@example.com" />
        </label>
        <label class="flex flex-col gap-5px text-13px font-700 text-muted">
          Gmail address (report sent FROM)
          <TextInput v-model="smtpUser" title="Dedicated Gmail address" placeholder="pos.yunfook@gmail.com" />
        </label>
        <label class="flex flex-col gap-5px text-13px font-700 text-muted">
          Gmail App Password
          <TextInput v-model="smtpPass" title="Gmail App Password (16 letters)" placeholder="abcd efgh ijkl mnop" />
        </label>
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
