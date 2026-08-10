<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import {
  fmtMoney,
  fmtQtyUnit,
  priceCentsFrom,
  toRM,
  toQty,
  toMilli,
  type PricedItem,
  type UnitType,
  type Unit,
} from "@yf/core";
import { imageCss, productImage } from "../productImage";
import { getRepo } from "../db";
import { useCatalog } from "../stores/catalog";
import { useUi } from "../stores/ui";
import { currentCompany } from "../place";
import TopBar from "../components/TopBar.vue";
import SelectInput from "../components/SelectInput.vue";
import TextInput from "../components/TextInput.vue";
import NumberInput from "../components/NumberInput.vue";
import ImagePickerDialog from "../components/ImagePickerDialog.vue";
import SettingsDialog from "../components/SettingsDialog.vue";
import { tintFromName } from "../tint";

const catalog = useCatalog();
const ui = useUi();

const items = ref<PricedItem[]>([]);
// Units come from the unit_types lookup table.
const unitTypes = ref<UnitType[]>([]);
const unitOptions = computed(() => unitTypes.value.map((q) => ({ value: q.name as Unit, label: q.name })));

interface TierDraft { minQtyUnits: number; priceRM: number }
interface EditDraft {
  id: number;
  name: string;
  unit: Unit;
  priceRM: number;
  image: string;
  active: boolean;
  tracksTail: boolean;
  tiers: TierDraft[];
}
const editing = ref<EditDraft | null>(null);
const imagePickerOpen = ref(false);
const settingsOpen = ref(false);

function onPickImage(key: string): void {
  if (editing.value) editing.value.image = key;
  imagePickerOpen.value = false;
}

// `key` is an internal unique slug (the app references items by id); generate it
// from the name so cashiers never have to think about it.
const slugify = (s: string) =>
  s.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "item";

function priceFromRM(value: number, label: string): number {
  try {
    return priceCentsFrom(value);
  } catch {
    throw new Error(`${label} must be a non-negative number`);
  }
}

async function refresh(): Promise<void> {
  const repo = await getRepo();
  unitTypes.value = await repo.listUnitTypes();
  items.value = await repo.listItems(true, currentCompany.value.id);
  await catalog.load(); // keep the till (active-only) in sync
}
onMounted(refresh);
// Items are per-company — reload the list when the company is switched in the nav.
watch(currentCompany, () => void refresh());

function openAdd(): void {
  editing.value = {
    id: 0, // 0 marks a not-yet-created item
    name: "",
    unit: "kg" as Unit,
    priceRM: 0,
    image: "",
    active: true,
    tracksTail: false,
    tiers: [],
  };
}

function openEdit(it: PricedItem): void {
  editing.value = {
    id: it.id,
    name: it.name,
    unit: it.unit,
    priceRM: toRM(it.priceCents),
    image: it.image,
    active: it.active,
    tracksTail: it.tracksTail,
    tiers: it.tiers.map((t) => ({ minQtyUnits: toQty(t.minQtyMilli), priceRM: toRM(t.priceCents) })),
  };
}

function addTierRow(): void {
  editing.value?.tiers.push({ minQtyUnits: 0, priceRM: 0 });
}
function removeTierRow(i: number): void {
  editing.value?.tiers.splice(i, 1);
}

async function saveEdit(): Promise<void> {
  const d = editing.value;
  if (!d) return;
  if (!d.name.trim()) {
    ui.showToast("Name is required");
    return;
  }
  const repo = await getRepo();
  try {
    const priceCents = priceFromRM(d.priceRM, "Price");
    const tiers = d.tiers
      .filter((t) => t.minQtyUnits > 0)
      .map((t, i) => ({
        minQtyMilli: toMilli(t.minQtyUnits),
        priceCents: priceFromRM(t.priceRM, `Discount ${i + 1} price`),
      }));
    if (d.id === 0) {
      const created = await repo.createItem({
        companyId: currentCompany.value.id,
        key: `${slugify(d.name)}-${Date.now().toString(36)}`,
        name: d.name.trim(),
        unit: d.unit,
        image: d.image,
        tint: tintFromName(d.name.trim()),
        priceCents,
        tracksTail: d.tracksTail,
      });
      if (tiers.length) await repo.setTiers(created.id, tiers);
    } else {
      await repo.updateItem(d.id, {
        name: d.name.trim(),
        unit: d.unit,
        image: d.image,
        priceCents,
        active: d.active,
        tracksTail: d.tracksTail,
      });
      await repo.setTiers(d.id, tiers);
    }
    editing.value = null;
    await refresh();
    ui.showToast(d.id === 0 ? "Item added" : "Saved");
  } catch (e) {
    ui.showToast(e instanceof Error ? e.message : "Could not save item");
  }
}

</script>

<template>
  <TopBar mode="admin" />

  <div class="flex-1 min-h-0 overflow-hidden p-24px flex flex-col gap-18px">
    <div class="flex items-center justify-between flex-none">
      <div class="text-23px font-800">Items &amp; Pricing</div>
      <div class="flex items-center gap-12px">
        <button class="pill-btn h-46px px-20px text-16px" @click="settingsOpen = true">Settings</button>
        <button class="btn-pay h-46px px-24px text-16px" @click="openAdd">+ Add item</button>
      </div>
    </div>

    <div class="flex gap-22px flex-1 min-h-0">
      <!-- item list -->
      <div class="flex-1 min-w-0 bg-surface border-2 border-border rounded-18px flex flex-col min-h-0">
        <div class="flex-1 min-h-0 overflow-auto">
          <table class="w-full border-collapse">
        <thead>
          <tr class="text-left text-13px font-800 text-muted uppercase tracking-wide">
            <th class="p-12px bg-panel sticky top-0 z-1">Item</th>
            <th class="p-12px bg-panel sticky top-0 z-1">Unit</th>
            <th class="p-12px bg-panel sticky top-0 z-1 text-right">Price</th>
            <th class="p-12px bg-panel sticky top-0 z-1">Conditions</th>
            <th class="p-12px bg-panel sticky top-0 z-1 text-right">Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="it in items"
            :key="it.id"
            class="border-t-2 border-borderSoft"
            :class="{ 'opacity-50': !it.active }"
          >
            <td class="p-12px">
              <div class="flex items-center gap-12px">
                <div
                  class="w-40px h-40px flex-none rounded-full flex items-center justify-center text-16px font-800 text-ink/70"
                  :style="{
                    backgroundColor: it.tint,
                    backgroundImage: imageCss(it.image),
                    backgroundSize: 'cover',
                    backgroundPosition: 'center',
                  }"
                >
                  <span v-if="!imageCss(it.image).startsWith('url')">{{ it.name.charAt(0).toUpperCase() }}</span>
                </div>
                <div class="text-16px font-800">{{ it.name }}</div>
                <span
                  v-if="it.tracksTail"
                  class="text-12px font-800 rounded-full px-8px py-2px bg-[#eef0e0] text-olive border-2 border-olive whitespace-nowrap"
                  title="Sold by Ekor"
                >ekor</span>
              </div>
            </td>
            <td class="p-12px text-15px font-700">{{ it.unit }}</td>
            <td class="p-12px text-right font-display text-18px">{{ fmtMoney(it.priceCents) }}</td>
            <td class="p-12px">
              <span v-if="!it.tiers.length" class="text-14px font-700 text-faint">—</span>
              <template v-else>
                <span
                  v-for="t in it.tiers"
                  :key="t.id"
                  class="inline-flex items-center gap-5px mr-6px mb-4px px-10px py-5px rounded-full bg-panel border-2 border-borderSoft text-13px font-800 text-ink whitespace-nowrap"
                >
                  {{ fmtQtyUnit(t.minQtyMilli, it.unit) }}
                  <span class="font-900 text-[#e0a92e]">=</span>
                  {{ fmtMoney(t.priceCents) }}
                </span>
              </template>
            </td>
            <td class="p-12px">
              <div class="flex gap-8px justify-end">
                <button class="pill-btn h-36px px-14px text-14px" @click="openEdit(it)">Edit</button>
              </div>
            </td>
          </tr>
        </tbody>
          </table>
        </div>
      </div>
    </div>
  </div>

  <!-- edit modal -->
  <div
    v-if="editing"
    class="fixed inset-0 bg-[rgba(44,38,32,.45)] flex items-center justify-center p-24px z-70"
    @click.self="editing = null"
  >
    <div class="w-full max-w-560px bg-cream border-2 border-border rounded-22px shadow-[0_24px_60px_rgba(0,0,0,.3)] p-26px max-h-[90vh] overflow-auto">
      <div class="text-22px font-800 mb-18px">
        {{ editing.id === 0 ? "Add item" : `Edit ${editing.name}` }}
      </div>
      <div class="flex flex-col gap-14px">
        <div class="flex gap-16px">
          <!-- left: large image picker -->
          <div class="flex flex-col gap-4px text-13px font-700 text-muted">
            Image
            <button
              type="button"
              class="w-150px h-150px flex-none rounded-16px border-2 overflow-hidden cursor-pointer press"
              :class="
                editing.image
                  ? 'border-border bg-white'
                  : 'border-dashed border-border bg-tile flex items-center justify-center'
              "
              title="Select image"
              @click="imagePickerOpen = true"
            >
              <img
                v-if="editing.image"
                :src="productImage(editing.image) ?? ''"
                alt=""
                class="w-full h-full object-contain"
              />
              <span v-else class="text-42px font-800 text-muted leading-none">＋</span>
            </button>
          </div>
          <!-- right: name, then unit + price -->
          <div class="flex-1 min-w-0 flex flex-col gap-12px">
            <label class="flex flex-col gap-4px text-13px font-700 text-muted">
              Name
              <TextInput v-model="editing.name" title="Item name" placeholder="e.g. Durian" class="w-full" />
            </label>
            <div class="flex gap-12px items-end">
              <div class="flex flex-col gap-4px text-13px font-700 text-muted">
                Unit
                <SelectInput v-model="editing.unit" :options="unitOptions" class="w-120px" />
              </div>
              <div class="flex flex-col gap-4px text-13px font-700 text-muted">
                Price
                <NumberInput v-model="editing.priceRM" title="Item price (RM)" prefix="RM" :decimals="2" class="w-130px" />
              </div>
              <!-- sold by the head: surfaces a separate "ekor" counter on the till -->
              <button
                type="button"
                class="h-44px px-16px rounded-12px border-2 text-15px font-800 cursor-pointer press flex items-center gap-8px"
                :class="editing.tracksTail ? 'bg-olive text-white border-olive' : 'bg-tile text-muted border-border'"
                :title="editing.tracksTail ? 'Cashier enters an Ekor count' : 'No Ekor count'"
                @click="editing.tracksTail = !editing.tracksTail"
              >
                <span
                  class="w-20px h-20px flex-none rounded-6px border-2 flex items-center justify-center"
                  :class="editing.tracksTail ? 'bg-white border-white' : 'border-current'"
                >
                  <svg
                    v-if="editing.tracksTail"
                    viewBox="0 0 24 24"
                    class="w-13px h-13px text-olive"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="4"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  >
                    <path d="M5 13l4 4L19 7" />
                  </svg>
                </span>
                Ekor
              </button>
            </div>
          </div>
        </div>

        <!-- tier editor -->
        <div class="mt-6px">
          <div class="flex items-center justify-between mb-8px">
            <span class="text-14px font-800">Condition</span>
            <button class="pill-btn h-32px px-12px text-13px" @click="addTierRow">+ Add tier</button>
          </div>
          <div v-if="!editing.tiers.length" class="text-13px font-700 text-faint">
            No discounts. e.g. add “≥ 30 → RM15” to drop the unit price at 30 {{ editing.unit }}.
          </div>
          <div
            v-for="(t, i) in editing.tiers"
            :key="i"
            class="flex items-center gap-12px mb-10px bg-surface border-2 border-borderSoft rounded-16px px-16px py-12px"
          >
            <NumberInput
              v-model="t.minQtyUnits"
              big
              :title="`Minimum quantity (${editing.unit})`"
              :unit="editing.unit"
              :suffix="editing.unit"
            />
            <span class="text-28px font-900 text-[#e0a92e]">=</span>
            <NumberInput
              v-model="t.priceRM"
              big
              title="Discount price (RM)"
              prefix="RM"
              :decimals="2"
              :suffix="`/ ${editing.unit}`"
            />
            <button
              class="w-34px h-34px flex-none ml-auto rounded-full border-none bg-[#d94b3d] text-16px font-900 text-white cursor-pointer press"
              @click="removeTierRow(i)"
            >✕</button>
          </div>
        </div>
      </div>

      <div class="flex gap-12px mt-22px">
        <button class="pill-btn flex-1 h-54px text-18px" @click="editing = null">Cancel</button>
        <button class="btn-pay flex-1 h-54px text-20px" @click="saveEdit">Save</button>
      </div>
    </div>
  </div>

  <ImagePickerDialog
    :open="imagePickerOpen"
    :current="editing?.image ?? ''"
    @select="onPickImage"
    @close="imagePickerOpen = false"
  />

  <SettingsDialog :open="settingsOpen" @close="settingsOpen = false" />

</template>
