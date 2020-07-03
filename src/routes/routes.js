import { Router } from 'express'
import axios from 'axios'
import { check, validationResult } from 'express-validator'
import moment from 'moment'

const routes = Router()

const { MOODLE_BASE_URL } = process.env
const MOODLE_TOKEN = '1398f75a226fa8cf9ed47902b8fd1a5e'
const MOODLE_FORMAT = 'json'
const API_BASE_URL = 'http://192.168.106.132/moodle'

const errorHandle = (status, data) => {
    const err = new Error()
    err.status = status
    err.error = data[Object.keys(data)[0]].msg
    err.data = null
    return err
}

const response = {
    successes: [],
    errors: [],
    errorDetails: []
}

routes.get('/', [check('test', 'invalid').exists()], async (req, res, next) => {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
        return next(errorHandle(400, errors.mapped()))
    }

    const params = new URLSearchParams()
    params.append('wstoken', MOODLE_TOKEN)
    params.append('wsfunction', 'core_course_get_courses')
    params.append('moodlewsrestformat', MOODLE_FORMAT)
    const data = await axios.post(`${API_BASE_URL}/webservice/rest/server.php`, params)
    res.json(data.data)
})

routes.post(
    '/courses',
    [
        check('fullName', 'invalid').exists(),
        check('shortName', 'invalid').exists(),
        check('catagoryId', 'invalid').exists(),
        check('startDate', 'invalid').exists(),
        check('stopDate', 'invalid').exists(),
        check('lang', 'invalid').exists(),
    ],
    async (req, res, next) => {
        const startDate = moment(req.body.startDate, 'YYYY-MM-DD HH:mm:ss').unix()
        const stopDate = moment(req.body.stopDate, 'YYYY-MM-DD HH:mm:ss').unix()

        const paramsCreateCourse = new URLSearchParams()
        paramsCreateCourse.append('wstoken', MOODLE_TOKEN)
        paramsCreateCourse.append('wsfunction', 'core_course_create_courses')
        paramsCreateCourse.append('moodlewsrestformat', MOODLE_FORMAT)

        paramsCreateCourse.append('courses[0][fullname]', req.body.fullName) // = string
        paramsCreateCourse.append('courses[0][shortname]', req.body.shortName) // = string
        paramsCreateCourse.append('courses[0][categoryid]', 1) // = int
        paramsCreateCourse.append('courses[0][idnumber]', '') // = string
        paramsCreateCourse.append('courses[0][summary]', '') // = string
        paramsCreateCourse.append('courses[0][summaryformat]', 1) // = int
        paramsCreateCourse.append('courses[0][format]', 'topics') // = string
        paramsCreateCourse.append('courses[0][showgrades]', 1) // = int
        paramsCreateCourse.append('courses[0][newsitems]', 5) // = int
        paramsCreateCourse.append('courses[0][startdate]', startDate) // = int
        paramsCreateCourse.append('courses[0][enddate]', stopDate) // = int
        paramsCreateCourse.append('courses[0][numsections]', 4) // = int
        paramsCreateCourse.append('courses[0][maxbytes]', 0) // = int
        paramsCreateCourse.append('courses[0][showreports]', 0) // = int
        paramsCreateCourse.append('courses[0][visible]', 1) // = int
        paramsCreateCourse.append('courses[0][hiddensections]', 0) // = int
        paramsCreateCourse.append('courses[0][groupmode]', 0) // = int
        paramsCreateCourse.append('courses[0][groupmodeforce]', 0) // = int
        paramsCreateCourse.append('courses[0][defaultgroupingid]', 0) // = int
        paramsCreateCourse.append('courses[0][enablecompletion]', 1) // = int
        paramsCreateCourse.append('courses[0][completionnotify]', 0) // = int
        paramsCreateCourse.append('courses[0][lang]', req.body.lang) // = string
        // paramsCreateCourse.append('courses[0][forcetheme]', '') // = string
        // paramsCreateCourse.append('courses[0][courseformatoptions][0][name]', '') // = string
        // paramsCreateCourse.append('courses[0][courseformatoptions][0][value]', '') // = string
        // paramsCreateCourse.append('courses[0][customfields][0][shortname]', '') // = string
        // paramsCreateCourse.append('courses[0][customfields][0][value]', '') // = string
        const data = await axios.post(`${API_BASE_URL}/webservice/rest/server.php`, paramsCreateCourse)
        res.json(data.data)
    },
)

routes.post('/course/:courseShortName/enrol/students', async (req, res, next) => {
    const paramsCourseDetail = new URLSearchParams()
    paramsCourseDetail.append('wstoken', MOODLE_TOKEN)
    paramsCourseDetail.append('wsfunction', 'core_course_get_courses_by_field')
    paramsCourseDetail.append('moodlewsrestformat', MOODLE_FORMAT)
    paramsCourseDetail.append('field', 'shortname')
    paramsCourseDetail.append('value', req.params.courseShortName)

    const courseDetail = await axios.post(`${API_BASE_URL}/webservice/rest/server.php`, paramsCourseDetail)

    if (!courseDetail.data.courses[0]) {
        res.statusCode = 404
        return res.json({ error: 'Course not found' })
    }

    const courseId = courseDetail.data.courses[0].id
    // enrolUser(5, 'email', 1)
    // Promise.all()
    // let a = [0, 1, 2, 3, 4, 5]
    // await Promise.all(
    //     a.map(async element => {
    //         return setTimeout(async () => {
    //             await console.log(`Completed in`)
    //         }, 1000)
    //     }),
    // )
    // console.log(2222)

    req.body.user.forEach(email => {
        // console.log(element)
        enrolUser(5, email, courseId)
    })

    res.json({ message: 'enrol all students' })
})

routes.post('/course/:courseShortName/enrol/teachers', async (req, res, next) => {
    const paramsCourseDetail = new URLSearchParams()
    paramsCourseDetail.append('wstoken', MOODLE_TOKEN)
    paramsCourseDetail.append('wsfunction', 'core_course_get_courses_by_field')
    paramsCourseDetail.append('moodlewsrestformat', MOODLE_FORMAT)
    paramsCourseDetail.append('field', 'shortname')
    paramsCourseDetail.append('value', req.params.courseShortName)

    const courseDetail = await axios.post(`${API_BASE_URL}/webservice/rest/server.php`, paramsCourseDetail)

    if (!courseDetail.data.courses[0]) {
        res.statusCode = 404
        return res.json({ error: 'Course not found' })
    }

    const courseId = courseDetail.data.courses[0].id

    req.body.user.forEach(email => {
        // console.log(element)
        enrolUser(3, email, courseId)
    })

    res.json({ message: 'enrol all teachers' })
})

const enrolUser = async (roleId, email, courseId) => {
    const paramsUserDetail = new URLSearchParams()
    paramsUserDetail.append('wstoken', MOODLE_TOKEN)
    paramsUserDetail.append('wsfunction', 'core_user_get_users')
    paramsUserDetail.append('moodlewsrestformat', MOODLE_FORMAT)
    paramsUserDetail.append('criteria[0][key]', 'email')
    paramsUserDetail.append('criteria[0][value]', email)

    const userDetail = await axios.post(`${API_BASE_URL}/webservice/rest/server.php`, paramsUserDetail)
    // console.log(userDetail.data.users[0].id)

    const paramsEnrolUser = new URLSearchParams()
    paramsEnrolUser.append('wstoken', MOODLE_TOKEN)
    paramsEnrolUser.append('wsfunction', 'enrol_manual_enrol_users')
    paramsEnrolUser.append('moodlewsrestformat', MOODLE_FORMAT)
    paramsEnrolUser.append('enrolments[0][roleid]', roleId)
    paramsEnrolUser.append('enrolments[0][userid]', userDetail.data.users[0].id)
    paramsEnrolUser.append('enrolments[0][courseid]', courseId)

    const courseDetail = await axios.post(`${API_BASE_URL}/webservice/rest/server.php`, paramsEnrolUser)
}

export default routes
