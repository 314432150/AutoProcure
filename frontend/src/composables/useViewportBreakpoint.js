import { onBeforeUnmount, onMounted, ref } from "vue";

export const useViewportBreakpoint = (maxWidth = 900) => {
  const matched = ref(false);

  const update = () => {
    const width = Math.round(window.visualViewport?.width || window.innerWidth);
    matched.value = width <= maxWidth;
  };

  onMounted(() => {
    update();
    requestAnimationFrame(update);
    setTimeout(update, 0);
    window.addEventListener("resize", update);
    window.addEventListener("orientationchange", update);
    window.visualViewport?.addEventListener("resize", update);
  });

  onBeforeUnmount(() => {
    window.removeEventListener("resize", update);
    window.removeEventListener("orientationchange", update);
    window.visualViewport?.removeEventListener("resize", update);
  });

  return matched;
};

