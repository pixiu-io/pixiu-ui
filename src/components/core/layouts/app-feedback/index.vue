<template>
  <a
    class="app-feedback"
    href="https://github.com/caoyingjunz/pixiu/issues"
    target="_blank"
    rel="noopener noreferrer"
    aria-label="反馈"
  >
    <span class="app-feedback__icon">
      <span class="app-feedback__icon-dot app-feedback__icon-dot--left"></span>
      <span class="app-feedback__icon-dot app-feedback__icon-dot--right"></span>
      <span class="app-feedback__icon-smile"></span>
    </span>
    <span class="app-feedback__text">反馈</span>
  </a>
</template>

<script setup lang="ts">
  defineOptions({ name: 'AppFeedback' })
</script>

<style scoped>
  .app-feedback {
    position: fixed;
    left: 0;
    bottom: 44px;
    z-index: 2500;
    display: inline-flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    width: 35px;
    min-height: 78px;
    padding: 8px 5px 10px;
    border-radius: 0 10px 10px 0;
    background: linear-gradient(180deg, #5b8ff9 0%, #3b82f6 100%);
    box-shadow: 0 10px 28px rgb(0 0 0 / 14%);
    color: #fff;
    font-size: 12px;
    font-weight: 500;
    line-height: 1;
    text-decoration: none;
    cursor: pointer;
    transition:
      transform 0.15s ease,
      box-shadow 0.15s ease,
      background-color 0.15s ease;
  }

  .app-feedback:hover {
    background: linear-gradient(180deg, #6a98fb 0%, #4b8cf7 100%);
    box-shadow: 0 12px 30px rgb(0 0 0 / 18%);
    transform: translateX(2px);
  }

  .app-feedback__icon {
    position: relative;
    width: 16px;
    height: 16px;
    margin-bottom: 6px;
    border: 1.5px solid #fff;
    border-radius: 50%;
    box-sizing: border-box;
  }

  .app-feedback__icon-dot {
    position: absolute;
    top: 3px;
    width: 2px;
    height: 2px;
    background: #fff;
    border-radius: 50%;
  }

  .app-feedback__icon-dot--left {
    left: 3px;
  }

  .app-feedback__icon-dot--right {
    right: 3px;
  }

  .app-feedback__icon-smile {
    position: absolute;
    left: 50%;
    bottom: 3px;
    width: 6px;
    height: 3px;
    border-bottom: 1.5px solid #fff;
    border-radius: 0 0 10px 10px;
    transform: translateX(-50%);
    box-sizing: border-box;
  }

  .app-feedback__text {
    writing-mode: vertical-rl;
    text-orientation: mixed;
    font-size: 12px;
    font-weight: 500;
    line-height: 1;
    letter-spacing: 0;
  }
</style>
