<template>
  <main class="seller-page">
    <section class="seller-page-inner">
      <header class="seller-page-header">
        <div>
          <h1 class="seller-page-title">Dashboard</h1>
        </div>
        <NuxtLink to="/seller/trips/new" class="inline-flex min-h-11 items-center gap-2 rounded-md bg-brand px-4 text-sm font-semibold text-white hover:bg-brand-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand">
          <span aria-hidden="true" class="text-base font-normal leading-none">+</span> Buat Trip Baru
        </NuxtLink>
      </header>

      <p v-if="errorMessage" class="mb-4 field-error">{{ errorMessage }}</p>
      <div v-else-if="pending" class="text-muted text-sm">
        Memuat dashboard...
      </div>
      <template v-else>
        <div class="gap-4 grid md:grid-cols-4">
          <article
            v-for="stat in stats"
            :key="stat.label"
            class="border-l-[5px] border-l-brand seller-card-padded"
          >
            <p class="text-muted text-sm">{{ stat.label }}</p>
            <p class="mt-2 font-semibold text-ink text-2xl">{{ stat.value }}</p>
            <p class="mt-1 text-muted text-xs">{{ stat.caption }}</p>
          </article>
        </div>

        <h2
          class="mt-9 mb-4 font-semibold text-muted text-sm uppercase tracking-wide"
        >
          Trip Saya
        </h2>
        <div v-if="!dashboard?.trips?.length" class="flex flex-col items-center gap-4 rounded-xl border border-dashed border-border px-6 py-14 text-center">
          <span class="flex size-12 items-center justify-center rounded-full bg-brand/10 text-brand" aria-hidden="true">
            <Icon name="material-symbols:flight-takeoff-rounded" class="text-2xl" />
          </span>
          <p class="font-semibold text-ink">Belum ada trip</p>
          <NuxtLink to="/seller/trips/new" class="inline-flex min-h-11 items-center gap-2 rounded-md bg-brand px-4 text-sm font-semibold text-white hover:bg-brand-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand">
            <span aria-hidden="true" class="text-base font-normal leading-none">+</span> Buat Trip Pertama
          </NuxtLink>
        </div>
        <div v-else class="space-y-4">
          <article
            v-for="trip in dashboard?.trips ?? []"
            :key="trip.id"
            class="flex sm:flex-row flex-col gap-3 sm:gap-4"
          >
            <NuxtLink
              :to="`/seller/trips/${trip.id}`"
              tabindex="-1"
              class="block relative bg-field rounded-xl w-full sm:w-80 lg:w-96 aspect-video overflow-hidden shrink-0"
            >
              <img
                v-if="trip.thumbnail_url"
                :src="trip.thumbnail_url"
                :alt="trip.title"
                class="absolute inset-0 size-full object-cover"
              />
              <span class="right-2 bottom-2 absolute px-2 py-0.5 rounded-full font-medium text-xs" :class="tripStatusClass(trip.status)">{{ formatTripStatus(trip.status) }}</span>
            </NuxtLink>
            <div class="flex-1 sm:py-1 min-w-0">
              <div class="flex items-start gap-2">
                <span class="mt-2.5 rounded-full size-2 shrink-0" :class="tripStatusDotClass(trip.status)" aria-hidden="true" />
                <h3 class="min-w-0 font-medium text-ink text-xl line-clamp-2 leading-snug">
                  <NuxtLink
                    :to="`/seller/trips/${trip.id}`"
                    class="hover:text-brand focus-visible:outline-2 focus-visible:outline-brand"
                  >{{ trip.title }}</NuxtLink>
                </h3>
              </div>
              <p class="flex flex-wrap items-center gap-x-1.5 mt-1 text-muted text-sm">
                <Icon v-if="countryFlagIcon(trip.destination)" :name="countryFlagIcon(trip.destination)" class="rounded-full ring-1 ring-black/10 shrink-0" aria-hidden="true" />
                {{ countryName(trip.destination) }} •
                {{ formatDate(trip.order_open_at) }} –
                {{ formatDate(trip.order_close_at) }}
              </p>
              <p v-if="trip.description" class="mt-3 text-muted text-sm line-clamp-1">{{ trip.description }}</p>
              <p class="flex items-center gap-3 mt-3 font-medium text-ink/70 text-sm">
                <span class="inline-flex items-center gap-1"><Icon name="material-symbols:inventory-2-outline-rounded" class="text-base" aria-hidden="true" />{{ trip.product_count }} produk</span>
                <span class="inline-flex items-center gap-1"><Icon name="material-symbols:receipt-long-outline-rounded" class="text-base" aria-hidden="true" />{{ trip.order_count }} pesanan</span>
              </p>
              <a
                :href="`/t/${trip.slug}`"
                target="_blank"
                rel="noopener"
                class="flex items-center gap-1 mt-2 w-fit max-w-full text-brand hover:text-brand-hover text-sm"
              >
                <Icon name="material-symbols:language-rounded" class="text-base shrink-0" aria-hidden="true" />
                <span class="underline underline-offset-2 truncate">{{ publicUrl(trip.slug) }}</span>
              </a>
            </div>
          </article>
        </div>
      </template>
    </section>
  </main>
</template>

<script setup lang="ts">
import { countryFlagIcon, countryName } from "#shared/utils/countries";
definePageMeta({ middleware: "seller", layout: "seller" });
useHead({ title: "Dashboard" });

const {
  data: dashboard,
  pending,
  error,
} = await useFetch("/api/seller/dashboard");
const errorMessage = computed(() =>
  error.value ? "Dashboard gagal dimuat." : "",
);
const stats = computed(() => [
  {
    label: "Total Trip",
    value: dashboard.value?.stats.total_trips ?? 0,
    caption: "semua waktu",
  },
  {
    label: "Trip Aktif",
    value: dashboard.value?.stats.active_trips ?? 0,
    caption: "sedang berjalan",
  },
  {
    label: "Pesanan Aktif",
    value: dashboard.value?.stats.active_orders ?? 0,
    caption: "perlu ditangani",
  },
  {
    label: "Revenue Selesai",
    value: formatCurrency(dashboard.value?.stats.completed_revenue ?? 0),
    caption: "dari trip selesai",
  },
]);

function formatCurrency(value: number) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(value);
}

const { host } = useRequestURL();
function publicUrl(slug: string) {
  return `${host}/t/${slug}`;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("id-ID", { dateStyle: "medium" }).format(
    new Date(value),
  );
}
</script>
