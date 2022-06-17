import { QueryClient, QueryClientProvider, useQuery } from 'react-query'
import { useState } from "react";
import React from "react";
import { export_tck } from "./ticket.js"
import { export_user } from "./users.js"
import { export_org } from "./organization.js"
import { ThemeProvider, createTheme } from '@mui/material/styles'
import { ImgIcon } from "./components/imgicon.js"

const darkTheme = createTheme({
  palette: {
    mode: 'dark',
  },
});

const queryClient = new QueryClient()


export default function DataProvider(obj) {
   return (
     <QueryClientProvider client={queryClient}>
       <ThemeProvider theme={darkTheme}>
         <Example obj={obj}/>
       </ThemeProvider>
     </QueryClientProvider>
   )
}


class FilterPane extends React.Component {
    constructor(props) {
        super(props)
        this.state = {string: "", status: {
            "Canceled": true,
            "Open": true,
            "In progress": true,
            "Done": true
            }}
    }

    apply_search = (event) => {
        this.setState({string: event.target.value})
        this.props.set_search(this.state)
    }

    replace_status = (event, status_name) => {
        this.setState((prevState => {
            var new_state = { ...prevState}
            new_state.status[status_name] = event.target.checked;
            this.props.set_search(new_state);
            return new_state}))
    }

    render () {
    return (
        <div className="filter-pane">
          <div>
            <span>
              <label htmlFor="search"><h4>Search</h4></label>
              <input type="text" name="search" className="search-input" onChange={this.apply_search}/>
            </span>
            {this.props.specific_search(this)}
          </div>
        </div>
    );}
}


function Example(obj) {
    const [get_selected, set_selected] = useState()
    const [all_tck, set_all_tck] = useState()
    const [search, set_search] = useState()
    const data_query = useQuery(obj.obj.obj + 'Data', () =>
      fetch(`${process.env.REACT_APP_API_SERVER}/api/${obj.obj.obj}`).then(res => res.json())
    )
    const my_profile = useQuery('myProfile', () =>
      fetch(`${process.env.REACT_APP_API_SERVER}/api/profile`).then(res => res.json())
    )

    if (data_query.data && typeof(all_tck) === 'undefined'){
        set_all_tck(data_query.data)
        return
    }
    if (data_query.isLoading) return 'Loading...'

    if (data_query.error) return 'An error has occurred: ' + data_query.error.message

    var obj_privitives = export_user
    if (obj.obj.obj === "tickets"){
        obj_privitives = export_tck
    } else if (obj.obj.obj === "organizations"){
        obj_privitives = export_org
    }

    const tickets = obj_privitives.from_json(all_tck, search, set_selected);
    const create_elem = obj_privitives.create(all_tck, set_all_tck, my_profile.data);
    const LeftPane = obj_privitives.pane_left
    const profile_icon = my_profile.isLoading || my_profile.error ? "" : <ImgIcon img_id={my_profile.data.user_id}/>
   return (
   <div>
     <div className="navbar">
        <a href='tickets'>Tickets</a>
        <a href='users'>Users</a>
        <a href='organizations'>Organizations</a>
        <div className='filler'></div>
        <span className="right">{profile_icon}
          {my_profile.isLoading || my_profile.error ? "" : my_profile.data.display_name}</span>
     </div>
     <LeftPane ticket={get_selected} set_ticket={set_selected} all_tck={all_tck} set_all_tck={set_all_tck}
       my_profile={my_profile.data}/>
     <FilterPane search={search} set_search={set_search} specific_search={obj_privitives.search}/>
     <div className="tickets-table">
       {create_elem}
       {tickets}
     </div>
   </div>
   )
}