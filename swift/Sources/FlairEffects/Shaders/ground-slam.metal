// flair-metal-hash: 8be5a131
#pragma clang diagnostic ignored "-Wmissing-prototypes"

#include <metal_stdlib>
#include <simd/simd.h>

using namespace metal;

// Implementation of the GLSL mod() function, which is slightly different than Metal fmod()
template<typename Tx, typename Ty>
inline Tx mod(Tx x, Ty y)
{
    return x - y * floor(x / y);
}

struct FlairUniforms
{
    packed_float3 iResolution;
    float iTime;
    float iTimeDelta;
    int iFrame;
    float iBeat;
    float flair_flipY;
    float4 iMouse;
    float4 iPointer;
    float4 iClicks[8];
    float4 iTrail[32];
    float4 iAudio;
    float4 iSpectrum[16];
    float4 iScroll;
    float3 uSky;
    float3 uGround;
    float3 uDust;
    packed_float3 uCrack;
    float uHorizon;
    int uCracks;
    float uReach;
    float uDustAmount;
    int uRocks;
    float uShake;
    float uLife;
    uint uDemo;
};

struct flair_ground_slam_frag_out
{
    float4 flair_FragColor [[color(0)]];
};

static inline __attribute__((always_inline))
float2 hash22(thread const float2& p)
{
    float3 p3 = fract(p.xyx * float3(0.103100001811981201171875, 0.10300000011920928955078125, 0.097300000488758087158203125));
    p3 += float3(dot(p3, p3.yzx + float3(33.3300018310546875)));
    return fract((p3.xx + p3.yz) * p3.zy);
}

static inline __attribute__((always_inline))
float4 hitAt(thread const int& i, thread const bool& demo, thread const float& every, constant FlairUniforms& _229)
{
    bool _217 = !demo;
    bool _235;
    if (!_217)
    {
        _235 = _229.iClicks[0].w > 0.5;
    }
    else
    {
        _235 = _217;
    }
    if (_235)
    {
        return _229.iClicks[i];
    }
    float k = floor(_229.iTime / every) - float(i);
    float2 param = float2((k * 1.37000000476837158203125) + 0.5, 3.7000000476837158203125);
    float2 h = hash22(param);
    return float4((float2(0.300000011920928955078125) + (h * 0.4000000059604644775390625)) * float2(_229.iResolution[0], _229.iResolution[1]), k * every, 1.0);
}

static inline __attribute__((always_inline))
float hash12(thread const float2& p)
{
    float3 p3 = fract(p.xyx * 0.103100001811981201171875);
    p3 += float3(dot(p3, p3.yzx + float3(33.3300018310546875)));
    return fract((p3.x + p3.y) * p3.z);
}

static inline __attribute__((always_inline))
float vnoise(thread const float2& p)
{
    float2 i = floor(p);
    float2 f = fract(p);
    float2 u = (f * f) * (float2(3.0) - (f * 2.0));
    float2 param = i;
    float a = hash12(param);
    float2 param_1 = i + float2(1.0, 0.0);
    float b = hash12(param_1);
    float2 param_2 = i + float2(0.0, 1.0);
    float c = hash12(param_2);
    float2 param_3 = i + float2(1.0);
    float d = hash12(param_3);
    return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}

static inline __attribute__((always_inline))
float fbm(thread float2& p, thread const int& octaves)
{
    float sum = 0.0;
    float amp = 0.5;
    float2x2 turn = float2x2(float2(0.800000011920928955078125, 0.60000002384185791015625), float2(-0.60000002384185791015625, 0.800000011920928955078125));
    for (int i = 0; i < 8; i++)
    {
        if (i >= octaves)
        {
            break;
        }
        float2 param = p;
        sum += (amp * vnoise(param));
        p = ((turn * p) * 2.019999980926513671875) + float2(17.0);
        amp *= 0.5;
    }
    return sum;
}

static inline __attribute__((always_inline))
float2 landing(thread const float4& c, thread const float& px, constant FlairUniforms& _229)
{
    float2 p = c.xy * px;
    bool _289 = _229.uDemo != 0u;
    bool _295;
    if (_289)
    {
        _295 = _229.iClicks[0].w < 0.5;
    }
    else
    {
        _295 = _289;
    }
    if (_295)
    {
        return float2(p.x, _229.uHorizon * (0.25 + (0.20000000298023223876953125 * fract(c.z * 0.617999970912933349609375))));
    }
    float _322;
    if (p.y < _229.uHorizon)
    {
        _322 = fast::clamp(p.y, 0.039999999105930328369140625, _229.uHorizon - 0.0599999986588954925537109375);
    }
    else
    {
        _322 = _229.uHorizon * 0.4000000059604644775390625;
    }
    return float2(p.x, _322);
}

static inline __attribute__((always_inline))
void mainImage(thread float4& fragColor, thread const float2& fragCoord, constant FlairUniforms& _229)
{
    float px = 1.0 / _229.iResolution[1u];
    float2 p = fragCoord * px;
    int param = 0;
    bool param_1 = _229.uDemo != 0u;
    float param_2 = 3.0;
    float4 c0 = hitAt(param, param_1, param_2, _229);
    float _361;
    if (c0.w > 0.5)
    {
        _361 = _229.iTime - c0.z;
    }
    else
    {
        _361 = 99.0;
    }
    float age0 = _361;
    if ((age0 >= 0.0) && (age0 < 1.0))
    {
        float k = (_229.uShake * exp((-age0) * 7.0)) * smoothstep(0.0, 0.0199999995529651641845703125, age0);
        p += (float2(sin(age0 * 61.0) + (0.5 * sin(age0 * 113.0)), cos((age0 * 79.0) + 1.0)) * (k * 0.02199999988079071044921875));
    }
    float above = p.y - _229.uHorizon;
    float3 col;
    if (above > 0.0)
    {
        col = mix(mix(_229.uSky, float3(1.0), float3(0.3499999940395355224609375)), _229.uSky * 0.85000002384185791015625, float3(smoothstep(0.0, 0.449999988079071044921875, above)));
    }
    else
    {
        float depth = fast::clamp((-above) / _229.uHorizon, 0.0, 1.0);
        float2 g = float2(p.x / (0.1500000059604644775390625 + depth), depth * 8.0);
        float2 param_3 = g * 3.0;
        int param_4 = 4;
        float _467 = fbm(param_3, param_4);
        float grain = _467;
        col = (_229.uGround * (0.7200000286102294921875 + (0.4000000059604644775390625 * depth))) * (0.85000002384185791015625 + (0.300000011920928955078125 * grain));
        col = mix(col, mix(_229.uSky, _229.uGround, float3(0.699999988079071044921875)), float3(exp((-depth) * 18.0) * 0.60000002384185791015625));
    }
    float dust = 0.0;
    float _801;
    for (int i = 2; i >= 0; i--)
    {
        int param_5 = i;
        bool param_6 = _229.uDemo != 0u;
        float param_7 = 3.0;
        float4 c = hitAt(param_5, param_6, param_7, _229);
        if (c.w < 0.5)
        {
            continue;
        }
        float age = _229.iTime - c.z;
        bool _528 = age < 0.0;
        bool _537;
        if (!_528)
        {
            _537 = age > _229.uLife;
        }
        else
        {
            _537 = _528;
        }
        if (_537)
        {
            continue;
        }
        float life = age / _229.uLife;
        float4 param_8 = c;
        float param_9 = px;
        float2 P = landing(param_8, param_9, _229);
        float2 d = p - P;
        float scale = mix(1.5, 0.5, P.y / _229.uHorizon);
        float2 q = float2(d.x, d.y / 0.2800000011920928955078125) / float2(scale);
        float r = length(q);
        if (above < 0.0)
        {
            float dent = exp(((-r) * r) / 0.0040000001899898052215576171875) * (1.0 - (life * 0.5));
            col *= (1.0 - (0.449999988079071044921875 * dent));
            float grow = _229.uReach * (1.0 - exp((-age) * 14.0));
            float n = float(_229.uCracks);
            float a = (precise::atan2(q.y, q.x) / 6.28318023681640625) + 0.5;
            float cell = floor(a * n);
            float crack = 0.0;
            for (int j = -1; j <= 1; j++)
            {
                float k_1 = mod(cell + float(j), n);
                float2 param_10 = float2(k_1 + 0.5, (c.z * 1.7000000476837158203125) + 3.0);
                float2 h = hash22(param_10);
                float len = grow * (0.449999988079071044921875 + (0.550000011920928955078125 * h.y));
                float ang = ((k_1 + 0.5) + ((h.x - 0.5) * 0.699999988079071044921875)) / n;
                float2 param_11 = float2(r * 18.0, (k_1 * 5.0) + c.z);
                ang += ((vnoise(param_11) - 0.5) * 0.0500000007450580596923828125);
                float da = (abs(fract((a - ang) + 0.5) - 0.5) * 6.28318023681640625) * r;
                float w = (0.007000000216066837310791015625 * (1.0 - (r / fast::max(len, 9.9999997473787516355514526367188e-05)))) + 0.001000000047497451305389404296875;
                float on = step(r, len) * smoothstep(w, w * 0.300000011920928955078125, da);
                crack = fast::max(crack, on);
            }
            col = mix(col, float3(_229.uCrack), float3(crack * (1.0 - smoothstep(0.60000002384185791015625, 1.0, life))));
        }
        float R = (0.5 * (1.0 - exp((-age) * 2.400000095367431640625))) * scale;
        float ringW = (0.070000000298023223876953125 * scale) * (0.5 + life);
        float height = (0.1599999964237213134765625 * scale) * (0.4000000059604644775390625 + life);
        float s = sqrt(fast::max((R * R) - (d.x * d.x), 0.0)) * 0.2800000011920928955078125;
        float side = smoothstep(R + ringW, R - (ringW * 0.300000011920928955078125), abs(d.x));
        float puff = 0.0;
        for (int f = 0; f < 2; f++)
        {
            if (f == 0)
            {
                _801 = s;
            }
            else
            {
                _801 = -s;
            }
            float yg = _801;
            float up = d.y - yg;
            puff += (smoothstep(((-ringW) * 0.2800000011920928955078125) * 2.0, 0.0, up) * (1.0 - smoothstep(0.0, height, up)));
        }
        float2 param_12 = (float2(precise::atan2(d.y, d.x) * 2.0, (length(d) * 6.0) - (age * 1.5)) * 2.5) + float2(c.z);
        int param_13 = 4;
        float _852 = fbm(param_12, param_13);
        float churn = _852;
        float densityHere = (((puff * side) * smoothstep(0.25, 0.64999997615814208984375, churn)) * (1.0 - life)) * smoothstep(0.0, 0.07999999821186065673828125, age);
        float plumeH = (0.20000000298023223876953125 * scale) * (1.0 - exp((-age) * 5.0));
        float plumeW = ((0.0500000007450580596923828125 * scale) * (1.0 + (2.0 * life))) * (0.60000002384185791015625 + (0.60000002384185791015625 * fast::clamp(d.y / fast::max(plumeH, 0.001000000047497451305389404296875), 0.0, 1.0)));
        float plume = (smoothstep(plumeW, plumeW * 0.300000011920928955078125, abs(d.x)) * smoothstep((-0.0199999995529651641845703125) * scale, 0.0, d.y)) * (1.0 - smoothstep(plumeH * 0.5, plumeH, d.y));
        densityHere = fast::max(densityHere, ((plume * smoothstep(0.300000011920928955078125, 0.60000002384185791015625, churn)) * (1.0 - life)) * (1.0 - life));
        dust = fast::max(dust, densityHere);
        for (int j_1 = 0; j_1 < 24; j_1++)
        {
            if (j_1 >= _229.uRocks)
            {
                break;
            }
            float2 param_14 = float2((float(j_1) * 3.7000000476837158203125) + 1.0, c.z * 2.2999999523162841796875);
            float2 h_1 = hash22(param_14);
            float2 param_15 = (h_1 * 37.0) + float2(c.z);
            float h3 = hash12(param_15);
            float vx = ((h_1.x - 0.5) * 0.60000002384185791015625) * scale;
            float vy = (0.5 + (0.89999997615814208984375 * h_1.y)) * scale;
            float depthOff = ((h3 - 0.5) * 0.119999997317790985107421875) * scale;
            float t = age;
            float g_1 = 3.2000000476837158203125 * scale;
            float flight = (2.0 * vy) / g_1;
            float tt = fast::min(t, flight);
            float2 pos = P + float2(vx * tt, (depthOff * 0.2800000011920928955078125) + fast::max((vy * tt) - (((0.5 * g_1) * tt) * tt), 0.0));
            float rr = (0.004999999888241291046142578125 + (0.00999999977648258209228515625 * h3)) * scale;
            float sd = length((p - pos) * float2(1.0, 1.2000000476837158203125)) - rr;
            float a_1 = (1.0 - smoothstep(-px, px, sd)) * (1.0 - smoothstep(0.75, 1.0, life));
            float3 rc = _229.uGround * (0.3499999940395355224609375 + (0.3499999940395355224609375 * h_1.y));
            rc += float3(0.1500000059604644775390625 * smoothstep(rr, -rr, dot(p - pos, float2(0.60000002384185791015625, -0.800000011920928955078125))));
            float2 below = (p - float2(pos.x, P.y + (depthOff * 0.2800000011920928955078125))) * float2(1.0, 3.0);
            float sh = exp((-dot(below, below)) / ((rr * rr) * 4.0));
            col *= (1.0 - (((0.300000011920928955078125 * sh) * step(above, 0.0)) * (1.0 - life)));
            col = mix(col, rc, float3(a_1));
        }
    }
    col = mix(col, _229.uDust * (0.85000002384185791015625 + (0.25 * smoothstep(0.0, 0.20000000298023223876953125, p.y))), float3(fast::clamp(dust * _229.uDustAmount, 0.0, 1.0)));
    fragColor = float4(col, 1.0);
}

fragment flair_ground_slam_frag_out flair_ground_slam_frag(constant FlairUniforms& _229 [[buffer(0)]], float4 gl_FragCoord [[position]])
{
    flair_ground_slam_frag_out out = {};
    float4 flair_color = float4(0.0, 0.0, 0.0, 1.0);
    float _1159;
    if (_229.flair_flipY > 0.5)
    {
        _1159 = _229.iResolution[1u] - gl_FragCoord.y;
    }
    else
    {
        _1159 = gl_FragCoord.y;
    }
    float2 flair_coord = float2(gl_FragCoord.x, _1159);
    float2 param_1 = flair_coord;
    float4 param;
    mainImage(param, param_1, _229);
    flair_color = param;
    out.flair_FragColor = flair_color;
    return out;
}

