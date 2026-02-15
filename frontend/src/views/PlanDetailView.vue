<script setup>
/** 页面职责：路由壳层，仅负责日期参数与返回导航 */
import { computed } from "vue";
import { useRoute } from "vue-router";
import PlanDetailEditor from "@/components/plans/PlanDetailEditor.vue";

const route = useRoute();

/** 当前计划日期（从路由参数读取） */
const planDate = computed(() => String(route.params.date || ""));
</script>

<template>
  <section class="page plan-detail-page">
    <el-card class="card table-card">
      <PlanDetailEditor :plan-date="planDate" />
    </el-card>
  </section>
</template>
