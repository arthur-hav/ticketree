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
   console.log(process.env.REACT_APP_API_SERVER)
   const { isLoading, error, data } = useQuery('ticketsData', () =>
     fetch(`${process.env.REACT_APP_API_SERVER}/api/tickets`).then(res => res.json())
   )

   if (isLoading) return 'Loading...'

   if (error) return 'An error has occurred: ' + error.message

   const tickets = data.tickets.map((tck) => {
     return (
       <li key={tck.ticket_id} class="paper">
         <h5>{tck.title}</h5>
         <button className="btn">&#8942;</button>
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