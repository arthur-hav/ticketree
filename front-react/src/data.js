 import { QueryClient, QueryClientProvider, useQuery } from 'react-query'

 const queryClient = new QueryClient()

 export default function DataProvider() {
   return (
     <QueryClientProvider client={queryClient}>
       <Example />
     </QueryClientProvider>
   )
 }


 function Example() {
   const { isLoading, error, data } = useQuery('repoData', () =>
     fetch('/api/tickets').then(res =>
       res.json()
     )
   )

   if (isLoading) return 'Loading...'

   if (error) return 'An error has occurred: ' + error.message

   const tickets = data.tickets.map((tck) => {
     return (
       <li key={tck.ticket_id} class="paper">
         <h5>{tck.title}</h5>
         <button>&#8942;</button>
       </li>
     );
   });

   return (
     <div>
        <ul>
        {tickets}
        </ul>
     </div>
   )
 }