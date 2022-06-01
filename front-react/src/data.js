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
   const { isLoading, error, data } = useQuery('ticketsData', () =>
     fetch(`${process.env.REACT_APP_API_SERVER}/api/tickets`).then(res => res.json())
   )

   if (isLoading) return 'Loading...'

   if (error) return 'An error has occurred: ' + error.message
    const progress_obj = {
        Open: "Open.png",
        Canceled: "Canceled.png",
        Done: "Done.png"
    }
    progress_obj["In progress"] = "Inprogress.png"
   const tickets = data.tickets.map((tck) => {
     const progress =  process.env.PUBLIC_URL + '/static/img/' + progress_obj[tck.status];
     return (
       <tr key={tck.ticket_id} class="paper">
         <td className="title">
           <h5>{tck.title}</h5>
         </td>
         <td className="icons" alt={tck.status}>
           <img src={progress}></img>
           <button className="btn">&#8942;</button>
         </td>
       </tr>
     );
   });

   return (
     <table className="tickets-table w-100 m-auto">
       <tbody>
         {tickets}
       </tbody>
     </table>
   )
}