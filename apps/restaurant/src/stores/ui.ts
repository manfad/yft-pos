import { shallowRef } from "vue";
import { defineStore } from "pinia";
import dayjs from "dayjs";

export const useRestaurantUiStore = defineStore("restaurant-ui", () => {
  const newOrderRequest = shallowRef(0);
  const reportDate = shallowRef(dayjs().format("YYYY-MM-DD"));
  function requestNewOrder(): void { newOrderRequest.value += 1; }
  return { newOrderRequest, reportDate, requestNewOrder };
});
