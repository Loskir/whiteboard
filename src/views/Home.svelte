<script lang="ts">
  import page from 'page'

  let boardId = ''

  const go = () => page.show(`/board/${boardId}`)
</script>

<main class="main">
  <h1>Hi! Enter board id</h1>
  <form on:submit|preventDefault={go}>
    <input bind:value={boardId}>
    <button type="submit">Go</button>
  </form>
</main>

<style lang="stylus">
  .main {
    flex-grow 1
    display flex
    flex-direction column
    justify-content center
    align-items center
  }
</style>
