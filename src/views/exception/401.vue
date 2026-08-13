<template>
  <ArtException :data="exceptionData" />
</template>

<script setup lang="ts">
  import { $t } from '@/locales'

  const exceptionData = {
    title: '401',
    desc: $t('httpMsg.unauthorized'),
    btnText: $t('exceptionPage.gohome'),
    imgUrl: '/src/assets/images/svg/403.svg'
  }
</script>
