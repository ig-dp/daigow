import type { RouterConfig } from '@nuxt/schema'

export default <RouterConfig>{
  routes: (routes) => [{
      name: 'public-product-detail-explicit',
      path: '/t/:slug/p/:id',
      component: () => import('./pages/t/[slug]/p/[id].vue')
    }, ...routes]
}
