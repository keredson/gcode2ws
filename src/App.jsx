import { useState, useEffect, useRef } from 'react'
import { Card, Col, Row } from 'antd';

import { Search } from './Search'
import { Printer } from './Printer'


function App() {
  const [printers, set_printers] = useState([])

  const printers_ref = useRef(null)
  useEffect(() => {
    printers_ref.printers = printers;
  }, [printers]);

  function add_printer(ip, port) {
    port = port || 81
    console.log('app adding printer', ip, port, printers_ref.printers)
    const matching_printers = printers_ref.printers.filter(printer => ((printer.ip==ip) && (printer.port==port)))
    console.log(printers_ref.printers, ip, port, matching_printers)
    if (matching_printers.length) {
      console.log('printer at', ip, port, 'already connected')
    } else {
      let new_printers = [...printers_ref.printers]
      new_printers.push({ ip, port:port })
      set_printers(new_printers)
    }
  }

  function remove(i) {
    console.log('printers_ref.printers',printers_ref.printers)
    printers_ref.printers.splice(i, 1)
    set_printers([...printers_ref.printers])
  }

  return (
    <Row gutter={[16, 16]}>
      {printers.map((printer, i) => <Printer key={i} printer={printer} close={()=>remove(i)} />)}
      <Search add_printer={(ip, port)=>add_printer(ip, port)} />
    </Row>
  )
}

export default App
