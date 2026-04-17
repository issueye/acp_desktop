<script setup>
import { computed, nextTick, ref, watch } from "vue";
import { X } from "lucide-vue-next";

const props = defineProps({
  visible: {
    type: Boolean,
    default: false,
  },
  title: {
    type: String,
    default: "",
  },
  description: {
    type: String,
    default: "",
  },
  kicker: {
    type: String,
    default: "",
  },
  width: {
    type: String,
    default: "640px",
  },
  maxWidth: {
    type: String,
    default: "min(640px, calc(100vw - 32px))",
  },
  closeOnScrim: {
    type: Boolean,
    default: true,
  },
  closeOnEsc: {
    type: Boolean,
    default: true,
  },
  persistent: {
    type: Boolean,
    default: false,
  },
});

const emit = defineEmits(["close", "update:visible"]);
const surfaceRef = ref(null);

const dialogStyle = computed(() => ({
  "--ued-dialog-width": props.width,
  "--ued-dialog-max-width": props.maxWidth,
}));

function handleClose() {
  emit("close");
  emit("update:visible", false);
}

function handleScrimClick() {
  if (!props.persistent && props.closeOnScrim) {
    handleClose();
  }
}

function handleKeydown(event) {
  if (!props.persistent && props.closeOnEsc && event.key === "Escape") {
    handleClose();
  }
}

watch(
  () => props.visible,
  async (visible) => {
    if (!visible) {
      return;
    }

    await nextTick();
    surfaceRef.value?.focus();
  },
);
</script>

<template>
  <Teleport to="body">
    <Transition name="ued-dialog-fade">
      <div v-if="visible" class="ued-modal" @keydown="handleKeydown">
        <div class="ued-modal__scrim" @click="handleScrimClick"></div>

        <div class="ued-modal__positioner" role="presentation">
          <section
            ref="surfaceRef"
            class="ued-modal__surface"
            :style="dialogStyle"
            role="dialog"
            aria-modal="true"
            :aria-label="title || '对话框'"
            tabindex="-1"
            @click.stop
          >
            <header class="ued-modal__header">
              <div class="ued-modal__heading">
                <div v-if="kicker" class="ued-kicker">{{ kicker }}</div>
                <h3 v-if="title" class="ued-modal__title">{{ title }}</h3>
                <p v-if="description" class="ued-modal__description">{{ description }}</p>
              </div>

              <button
                class="ued-icon-btn ued-modal__close"
                type="button"
                aria-label="关闭对话框"
                @click="handleClose"
              >
                <X :size="16" />
              </button>
            </header>

            <div v-if="$slots.summary" class="ued-modal__summary">
              <slot name="summary" />
            </div>

            <div class="ued-modal__body">
              <slot />
            </div>

            <footer v-if="$slots.footer" class="ued-modal__footer">
              <slot name="footer" />
            </footer>
          </section>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>