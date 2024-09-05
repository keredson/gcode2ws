import { useState, useEffect, useRef } from 'react'
import { Row, Typography } from 'antd';
import 'github-fork-ribbon-css/gh-fork-ribbon.css'

import { Search } from './Search'
import { Printer } from './Printer'

const { Title } = Typography;


function App() {
  const [printers, set_printers] = useState([])

  const printers_ref = useRef(null)
  useEffect(() => {
    printers_ref.current = printers;
  }, [printers]);

  function add_printer(ws, url) {
    console.log('app adding printer', ws, url, printers_ref.current)
    const matching_printers = printers_ref.current.filter(printer => (printer.url==url))
    console.log(printers_ref.current, ws, url, matching_printers)
    if (matching_printers.length) {
      console.log('printer at', ws, url, 'already connected')
    } else {
      let new_printers = [...printers_ref.current]
      new_printers.push({ ws, url })
      set_printers(new_printers)
    }
  }

  function remove(i) {
    console.log('printers_ref.printers',printers_ref.current, i)
    printers_ref.current.splice(i, 1)
    set_printers([...printers_ref.current])
  }

  return (
    <>
      <a class="github-fork-ribbon" target='_blank' href="https://github.com/keredson/gcode2ws" data-ribbon="Fork me on GitHub" title="Fork me on GitHub">Fork me on GitHub</a>
      <Title style={{textAlign:'center'}}>Send G-Code</Title>
      <Row gutter={[16, 16]}>
        <Search add_printer={(ws, url)=>add_printer(ws, url)} printer_count={printers.length} />
      {printers.map((printer, i) => <Printer key={i} printer={printer} close={()=>remove(i)} />)}
    </Row>
    </>
  )
}

export default App
