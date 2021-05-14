<script lang="ts">
  import page from 'page'

  import Home from './views/Home.svelte'
  import Board from './views/Board.svelte'

  let current = Home
  let ctx

  let setRoute = (component) => (context) => {
    ctx = context
    current = component
  }

  page('/', setRoute(Home))
  page('/board/:id', setRoute(Board))
  page()
</script>

<svelte:component this="{current}" {ctx}/>
