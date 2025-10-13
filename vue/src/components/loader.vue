<template>
  <div class="container">
    <div class="loader"></div>
  </div>
</template>
<style scoped>
body {
  height: 100vh;
  margin: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: black;
}
.container {
  display: flex;
  justify-content: center;
}

.loader {
  --color1: linear-gradient(
    9090deg,
    rgba(230, 70, 50, 1) 0%,
    rgba(250, 120, 20, 1) 100%
  );
  --color2: linear-gradient(
    9090deg,
    rgba(230, 70, 50, 1) 0%,
    rgba(250, 120, 20, 1) 100%
  );
  width: 3.75em;
  aspect-ratio: 1;
  position: relative;
  animation: spin 10000ms infinite linear;
}
.loader:before,
.loader:after {
  content: "";
  position: absolute;
  background: var(--color1);
  animation: squeeze 3000ms infinite;
  box-shadow: 0px 0px 15px 5px rgba(250, 120, 20, 0.3);
}
.loader:after {
  background: var(--color2);
  animation-delay: -1.25s;
  border-radius: 50px;
}
@keyframes squeeze {
  0% {
    inset: 0 2em 2em 0;
  }
  12.5% {
    inset: 0 2em 0 0;
  }
  25% {
    inset: 2em 2em 0 0;
  }
  37.5% {
    inset: 2em 0 0 0;
  }
  50% {
    inset: 2em 0 0 2em;
  }
  62.5% {
    inset: 0 0 0 2em;
  }
  75% {
    inset: 0 0 2em 2em;
  }
  87.5% {
    inset: 0 0 2em 0;
  }
  100% {
    inset: 0 2em 2em 0;
  }
}
@keyframes spin {
  to {
  }
}
</style>
