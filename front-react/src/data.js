import { QueryClient, QueryClientProvider, useQuery } from 'react-query'
import { useState } from "react";

const queryClient = new QueryClient()

const status_list = ["Canceled", "Open", "In progress", "Done"]

function create_ticket(event){
    var ticket_obj = {
        title: 'title',
        status: 'Open',
        description: 'Description',
        organization: null,
        assignee: null,
        parent_id: null,
        ticket_type: 'incident'
    }
    var url = `${process.env.REACT_APP_API_SERVER}/api/tickets`
    var xhr = new XMLHttpRequest();
    xhr.open("POST", url);
    xhr.setRequestHeader("Accept", "application/json");
    xhr.setRequestHeader("Content-Type", "application/json");
    xhr.send(JSON.stringify(ticket_obj));
}

export default function DataProvider() {
   return (
     <QueryClientProvider client={queryClient}>
       <Example />
     </QueryClientProvider>
   )
}

function put_status(ticket, all_tck, set_all_tck, dir){
    const new_status_idx = status_list.indexOf(ticket.status) + dir
    if (new_status_idx < 0 || new_status_idx > 3) return;
    ticket.status = status_list[new_status_idx]
    var url = `${process.env.REACT_APP_API_SERVER}/api/tickets`
    var xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    xhr.setRequestHeader("Accept", "application/json");
    xhr.setRequestHeader("Content-Type", "application/json");
    //xhr.send(JSON.stringify(ticket));
    const new_tck = all_tck.tickets.map((tck) => tck.ticket_id == ticket ? tck : ticket)
    set_all_tck(new_tck)
}


const PaneLeft: React.FC<Props> = ({
  ticket,
  all_tck,
  set_all_tck
}) => {
      if (!ticket){
        return (
          <h4>Select a ticket to see its details</h4>
        );
      }
      return (
      <div>
        <div>
          <h5>{ticket.title}</h5>
        </div>
        <div>
          <span>{ticket.description}</span>
        </div>
        <div className="align-center">
          <span className="status-group">
            <button className="btn" onClick={() => put_status(ticket, all_tck, set_all_tck, - 1)}>&#9664;</button>
            <span className="status-badge">{ticket.status}</span>
            <button className="btn" onClick={() => put_status(ticket, all_tck, set_all_tck, + 1)}>&#9654;</button>
          </span>
        </div>
        <div>
          {ticket.assignee}
        </div>
        <div>
          {ticket.owner}
        </div>
      </div>
      );
}



function Example() {
    const [get_selected, set_selected] = useState()
    const [all_tck, set_all_tck] = useState()
    const { isLoading, error, data } = useQuery('ticketsData', () =>
      fetch(`${process.env.REACT_APP_API_SERVER}/api/tickets`).then(res => res.json())
    )
    if (data != all_tck){
        set_all_tck(data)
        return
    }

    if (isLoading) return 'Loading...'

    if (error) return 'An error has occurred: ' + error.message
    const progress_obj = {
        Open: "Open.png",
        Canceled: "Canceled.png",
        Done: "Done.png"
    }
    progress_obj["In progress"] = "Inprogress.png"

    const tickets = all_tck.tickets.map((tck) => {
    const progress =  process.env.PUBLIC_URL + '/static/img/' + progress_obj[tck.status];
    return (
      <tr key={tck.ticket_id} className="paper">
        <td className="title" onClick={() => set_selected(tck)}>
           <h5>{tck.title}</h5>
        </td>
        <td className="icons">
          <img src={progress} alt={tck.status}></img>
        </td>
        <td>
          <button type="button" className="btn btn-secondary dropdown-toggle dropdown-toggle-split"
             data-bs-toggle="dropdown" aria-expanded="false">
            <span className="visually-hidden">Toggle Dropdown</span>
          </button>
          <ul className="dropdown-menu dropdown-menu-end">
            <li><span className="dropdown-item" onClick={create_ticket}>Create son</span></li>
          </ul>
        </td>
      </tr>
    );
   });



   return (
   <div>
     <div className="pane-left">
       <PaneLeft ticket={get_selected} all_tck={all_tck} set_all_tck={set_all_tck}/>
     </div>
     <div className="tickets-table">
       <table>
         <tbody>
           {tickets}
         </tbody>
       </table>
     </div>
   </div>
   )
}