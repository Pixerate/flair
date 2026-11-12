// flair-metal-hash: 1570e54e
#pragma clang diagnostic ignored "-Wunused-variable"
#pragma clang diagnostic ignored "-Wunused-const-variable"
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
    float3 uSurface;
    packed_float3 uPlastic;
    float uRows;
    float uRefill;
    float uLoop;
    uint uDemo;
};

struct flair_bubble_wrap_frag_out
{
    float4 flair_FragColor [[color(0)]];
};

static inline __attribute__((always_inline))
float4 cellOf(thread const float2& p, constant FlairUniforms& _131)
{
    float s = 1.0 / _131.uRows;
    float rh = s * 0.865999996662139892578125;
    float j0 = floor(p.y / rh);
    float4 best = float4(0.0);
    float bd = 1000000000.0;
    for (int k = -1; k <= 1; k++)
    {
        float j = j0 + float(k);
        float off = 0.5 * mod(j, 2.0);
        float i0 = floor(((p.x / s) - off) - 0.5);
        for (int m = 0; m <= 1; m++)
        {
            float i = i0 + float(m);
            float2 c = float2(((i + 0.5) + off) * s, (j + 0.5) * rh);
            float d = length(p - c);
            if (d < bd)
            {
                bd = d;
                best = float4(c, i, j);
            }
        }
    }
    return best;
}

static inline __attribute__((always_inline))
float hash12(thread const float2& p)
{
    float3 p3 = fract(p.xyx * 0.103100001811981201171875);
    p3 += float3(dot(p3, p3.yzx + float3(33.3300018310546875)));
    return fract((p3.x + p3.y) * p3.z);
}

static inline __attribute__((always_inline))
float2 popOf(thread const float2& id, constant FlairUniforms& _131)
{
    bool _237 = !(_131.uDemo != 0u);
    bool _246;
    if (!_237)
    {
        _246 = _131.iClicks[0].w > 0.5;
    }
    else
    {
        _246 = _237;
    }
    if (_246)
    {
        float pop = -1.0;
        for (int j = 7; j >= 0; j--)
        {
            float4 c = _131.iClicks[j];
            if (c.w < 0.5)
            {
                continue;
            }
            float age = _131.iTime - c.z;
            bool _278 = age < 0.0;
            bool _289;
            if (!_278)
            {
                _289 = age > (_131.uRefill + 0.800000011920928955078125);
            }
            else
            {
                _289 = _278;
            }
            if (_289)
            {
                continue;
            }
            float2 at = c.xy / float2(_131.iResolution[1u]);
            float2 param = at;
            float4 cell = cellOf(param, _131);
            bool _308 = cell.z != id.x;
            bool _317;
            if (!_308)
            {
                _317 = cell.w != id.y;
            }
            else
            {
                _317 = _308;
            }
            if (_317)
            {
                continue;
            }
            bool _322 = pop < 0.0;
            bool _333;
            if (!_322)
            {
                _333 = c.z > (pop + _131.uRefill);
            }
            else
            {
                _333 = _322;
            }
            if (_333)
            {
                pop = c.z;
            }
        }
        return float2(pop, pop + _131.uRefill);
    }
    float k = floor(_131.iTime / _131.uLoop);
    float2 param_1 = id + float2(k * 7.099999904632568359375);
    float at_1 = ((k + 0.039999999105930328369140625) + (0.800000011920928955078125 * hash12(param_1))) * _131.uLoop;
    float2 param_2 = ((id * 1.2999999523162841796875) + float2(k * 3.2999999523162841796875)) + float2(0.5);
    bool _385 = hash12(param_2) > 0.64999997615814208984375;
    bool _393;
    if (!_385)
    {
        _393 = _131.iTime < at_1;
    }
    else
    {
        _393 = _385;
    }
    if (_393)
    {
        return float2(-1.0, 0.0);
    }
    return float2(at_1, ((k + 1.0) * _131.uLoop) - 0.800000011920928955078125);
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
void mainImage(thread float4& fragColor, thread const float2& fragCoord, constant FlairUniforms& _131)
{
    float px = 1.0 / _131.iResolution[1u];
    float2 p = fragCoord * px;
    float2 param = p;
    float4 cell = cellOf(param, _131);
    float R = 0.4000000059604644775390625 / _131.uRows;
    float2 param_1 = cell.zw;
    float2 st = popOf(param_1, _131);
    float _434;
    if (st.x < 0.0)
    {
        _434 = 0.0;
    }
    else
    {
        _434 = smoothstep(st.x, st.x + 0.0599999986588954925537109375, _131.iTime) * (1.0 - smoothstep(st.y, st.y + 0.800000011920928955078125, _131.iTime));
    }
    float deflated = _434;
    float h = 1.0 - (0.87999999523162841796875 * deflated);
    float2 q = (p - cell.xy) / float2(R);
    float r = length(q);
    float2 param_2 = p * 40.0;
    float3 col = _131.uSurface * (0.920000016689300537109375 + (0.07999999821186065673828125 * vnoise(param_2)));
    float shadow = length(q - float2(0.180000007152557373046875, -0.23999999463558197021484375));
    col *= (1.0 - ((0.37999999523162841796875 * h) * (1.0 - smoothstep(0.75, 1.2000000476837158203125, shadow))));
    col = mix(col, float3(_131.uPlastic), float3(0.1599999964237213134765625));
    float edge = px / R;
    float inside = 1.0 - smoothstep(1.0 - edge, 1.0 + edge, r);
    if (inside > 0.0)
    {
        float rr = fast::min(r, 1.0);
        float z = sqrt(1.0 - (rr * rr));
        float3 n = float3(q * h, (z + 1.0) - h);
        float2 o = cell.zw * 5.30000019073486328125;
        float2 param_3 = (q * 4.0) + o;
        float2 param_4 = ((q * 4.0) + o) + float2(7.69999980926513671875);
        float2 wr = float2(vnoise(param_3), vnoise(param_4)) - float2(0.5);
        float2 param_5 = ((q * 3.0) + o) + float2(2.099999904632568359375);
        float crease = 1.0 - smoothstep(0.0, 0.0599999986588954925537109375, abs(vnoise(param_5) - 0.5));
        float3 _600 = n;
        float2 _602 = _600.xy + (((wr * 1.60000002384185791015625) + float2(crease * 0.300000011920928955078125)) * deflated);
        n.x = _602.x;
        n.y = _602.y;
        n = fast::normalize(n);
        float3 L = float3(-0.447213590145111083984375, 0.536656320095062255859375, 0.715541779994964599609375);
        float diff = fast::max(dot(n, L), 0.0);
        float spec = powr(fast::max(dot(reflect(-L, n), float3(0.0, 0.0, 1.0)), 0.0), 40.0);
        float3 b = mix(col, float3(_131.uPlastic), float3(0.180000007152557373046875 + ((0.4000000059604644775390625 * powr(1.0 - z, 2.0)) * h)));
        b *= (0.819999992847442626953125 + (0.300000011920928955078125 * diff));
        b += float3(spec * ((0.85000002384185791015625 * h) + (0.5 * deflated)));
        b += (float3(0.89999997615814208984375, 0.9700000286102294921875, 1.0) * ((0.2199999988079071044921875 * smoothstep(0.7200000286102294921875, 0.959999978542327880859375, r)) * h));
        b -= float3((0.119999997317790985107421875 * crease) * deflated);
        b *= (1.0 - (0.180000007152557373046875 * smoothstep(0.89999997615814208984375, 1.0, r)));
        if (st.x >= 0.0)
        {
            b += float3(0.3499999940395355224609375 * (1.0 - smoothstep(0.0, 0.1500000059604644775390625, _131.iTime - st.x)));
        }
        col = mix(col, b, float3(inside));
    }
    fragColor = float4(col, 1.0);
}

fragment flair_bubble_wrap_frag_out flair_bubble_wrap_frag(constant FlairUniforms& _131 [[buffer(0)]], float4 gl_FragCoord [[position]])
{
    flair_bubble_wrap_frag_out out = {};
    float4 flair_color = float4(0.0, 0.0, 0.0, 1.0);
    float _726;
    if (_131.flair_flipY > 0.5)
    {
        _726 = _131.iResolution[1u] - gl_FragCoord.y;
    }
    else
    {
        _726 = gl_FragCoord.y;
    }
    float2 flair_coord = float2(gl_FragCoord.x, _726);
    float2 param_1 = flair_coord;
    float4 param;
    mainImage(param, param_1, _131);
    flair_color = param;
    out.flair_FragColor = flair_color;
    return out;
}

