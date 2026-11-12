// flair-metal-hash: 7f83ff6c
#pragma clang diagnostic ignored "-Wunused-variable"
#pragma clang diagnostic ignored "-Wunused-const-variable"
#pragma clang diagnostic ignored "-Wmissing-prototypes"

#include <metal_stdlib>
#include <simd/simd.h>

using namespace metal;

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
    float uRain;
    float uSize;
    float uStrength;
    float uSpeed;
    packed_float3 uTint;
    float uTintAmount;
    uint uDemo;
    char _m20_pad[12];
    packed_float3 uBackdrop;
    float uBackdropAlpha;
};

struct flair_pond_ripples_frag_out
{
    float4 flair_FragColor [[color(0)]];
};

static inline __attribute__((always_inline))
float hash12(thread const float2& p)
{
    float3 p3 = fract(p.xyx * 0.103100001811981201171875);
    p3 += float3(dot(p3, p3.yzx + float3(33.3300018310546875)));
    return fract((p3.x + p3.y) * p3.z);
}

static inline __attribute__((always_inline))
float2 hash22(thread const float2& p)
{
    float3 p3 = fract(p.xyx * float3(0.103100001811981201171875, 0.10300000011920928955078125, 0.097300000488758087158203125));
    p3 += float3(dot(p3, p3.yzx + float3(33.3300018310546875)));
    return fract((p3.xx + p3.yz) * p3.zy);
}

static inline __attribute__((always_inline))
float2 ring(thread const float2& p, thread const float2& c, thread const float& age, thread const float& speed, thread const float& life, thread const float& amp, constant FlairUniforms& _128)
{
    if ((age < 0.0) || (age > life))
    {
        return float2(0.0);
    }
    float2 d = p - c;
    float r = length(d);
    float front = age * speed;
    float x = r - front;
    float width = (0.02500000037252902984619140625 * _128.uSize) + (age * 0.01200000010430812835693359375);
    float k = 6.28318023681640625 / ((0.0350000001490116119384765625 * _128.uSize) + (age * 0.00999999977648258209228515625));
    float env = (exp(((-x) * x) / (width * width)) * (1.0 - (age / life))) * smoothstep(0.0, 0.039999999105930328369140625, age);
    float slope = (((k * cos(k * x)) - (((2.0 * x) / (width * width)) * sin(k * x))) * env) * amp;
    return (d / float2(fast::max(r, 9.9999997473787516355514526367188e-05))) * slope;
}

static inline __attribute__((always_inline))
float4 overBackdrop(thread const float4& s, constant FlairUniforms& _128)
{
    float3 colour = fast::min(s.xyz, float3(s.w)) + ((float3(_128.uBackdrop) * _128.uBackdropAlpha) * (1.0 - s.w));
    float alpha = s.w + (_128.uBackdropAlpha * (1.0 - s.w));
    return float4(colour / float3(fast::max(alpha, 9.9999997473787516355514526367188e-05)), alpha);
}

static inline __attribute__((always_inline))
float3 testCard(thread const float2& uv)
{
    float3 sky = mix(float3(0.980000019073486328125, 0.62000000476837158203125, 0.4199999868869781494140625), float3(0.23999999463558197021484375, 0.319999992847442626953125, 0.7200000286102294921875), float3(uv.y));
    float sun = smoothstep(0.1599999964237213134765625, 0.1500000059604644775390625, length((uv - float2(0.64999997615814208984375, 0.579999983310699462890625)) * float2(1.60000002384185791015625, 1.0)));
    float hills = step(uv.y, (0.319999992847442626953125 + (0.0599999986588954925537109375 * sin(uv.x * 9.0))) + (0.039999999105930328369140625 * sin((uv.x * 23.0) + 1.0)));
    float3 col = mix(sky, float3(1.0, 0.920000016689300537109375, 0.699999988079071044921875), float3(sun));
    col = mix(col, float3(0.119999997317790985107421875, 0.2800000011920928955078125, 0.23999999463558197021484375) + float3(0.07999999821186065673828125 * sin(uv.x * 40.0)), float3(hills));
    float2 grid = abs(fract(uv * 8.0) - float2(0.5));
    col += float3(0.039999999105930328369140625 * step(0.4799999892711639404296875, fast::max(grid.x, grid.y)));
    return col;
}

static inline __attribute__((always_inline))
float4 pictureRGBA(texture2d<float> tex, sampler texSmplr, thread const float2& uv, constant FlairUniforms& _128)
{
    float4 _270;
    if (int2(tex.get_width(), tex.get_height()).x > 1)
    {
        float4 param = tex.sample(texSmplr, uv);
        _270 = overBackdrop(param, _128);
    }
    else
    {
        float2 param_1 = fract(uv);
        _270 = float4(testCard(param_1), 1.0);
    }
    return _270;
}

static inline __attribute__((always_inline))
void mainImage(thread float4& fragColor, thread const float2& fragCoord, constant FlairUniforms& _128, texture2d<float> uImage, sampler uImageSmplr)
{
    float2 uv = fragCoord / float2(_128.iResolution[0], _128.iResolution[1]);
    float px = 1.0 / _128.iResolution[1u];
    float2 p = fragCoord * px;
    float t = _128.iTime * _128.uSpeed;
    float2 grad = float2(0.0);
    if (_128.uRain > 0.0)
    {
        float2 base = floor(p / float2(0.2199999988079071044921875));
        for (int j = -1; j <= 1; j++)
        {
            for (int i = -1; i <= 1; i++)
            {
                float2 cell = base + float2(float(i), float(j));
                float2 param = cell;
                float period = mix(3.5, 0.89999997615814208984375, _128.uRain) * (0.699999988079071044921875 + (0.60000002384185791015625 * hash12(param)));
                float2 param_1 = cell + float2(4.19999980926513671875);
                float time = t + (hash12(param_1) * period);
                float cycle = floor(time / period);
                float age = time - (cycle * period);
                float2 param_2 = cell + float2(cycle * 3.7000000476837158203125);
                if (hash12(param_2) > (0.3499999940395355224609375 + (0.64999997615814208984375 * _128.uRain)))
                {
                    continue;
                }
                float2 param_3 = cell + float2(cycle);
                float2 c = ((cell + float2(0.1500000059604644775390625)) + (hash22(param_3) * 0.699999988079071044921875)) * 0.2199999988079071044921875;
                float2 param_4 = p;
                float2 param_5 = c;
                float param_6 = age;
                float param_7 = 0.119999997317790985107421875 * _128.uSize;
                float param_8 = fast::min(period, 1.60000002384185791015625);
                float param_9 = 0.00120000005699694156646728515625 * _128.uSize;
                grad += ring(param_4, param_5, param_6, param_7, param_8, param_9, _128);
            }
        }
    }
    bool _541 = _128.iClicks[0].w > 0.5;
    bool _551;
    if (!_541)
    {
        _551 = !(_128.uDemo != 0u);
    }
    else
    {
        _551 = _541;
    }
    if (_551)
    {
        for (int i_1 = 0; i_1 < 8; i_1++)
        {
            float4 c_1 = _128.iClicks[i_1];
            if (c_1.w < 0.5)
            {
                continue;
            }
            float2 param_10 = p;
            float2 param_11 = c_1.xy * px;
            float param_12 = (_128.iTime - c_1.z) * _128.uSpeed;
            float param_13 = 0.20000000298023223876953125 * _128.uSize;
            float param_14 = 3.0;
            float param_15 = 0.0040000001899898052215576171875 * _128.uSize;
            grad += ring(param_10, param_11, param_12, param_13, param_14, param_15, _128);
        }
    }
    else
    {
        float k = floor(t / 3.0);
        float2 param_16 = float2(k, 1.0);
        float2 param_17 = float2(k, 2.0);
        float2 at = float2(((0.20000000298023223876953125 + (0.60000002384185791015625 * hash12(param_16))) * _128.iResolution[0u]) * px, 0.25 + (0.5 * hash12(param_17)));
        float2 param_18 = p;
        float2 param_19 = at;
        float param_20 = t - (k * 3.0);
        float param_21 = 0.20000000298023223876953125 * _128.uSize;
        float param_22 = 3.0;
        float param_23 = 0.0040000001899898052215576171875 * _128.uSize;
        grad += ring(param_18, param_19, param_20, param_21, param_22, param_23, _128);
    }
    float2 offset = (grad * 0.60000002384185791015625) * _128.uStrength;
    offset.x *= (_128.iResolution[1u] / _128.iResolution[0u]);
    float2 param_24 = uv - offset;
    float4 pic = pictureRGBA(uImage, uImageSmplr, param_24, _128);
    float3 col = mix(pic.xyz, (pic.xyz * float3(_128.uTint)) * 1.2000000476837158203125, float3(_128.uTintAmount));
    float3 n = fast::normalize(float3((-grad) * 1.5, 1.0));
    float3 l = float3(-0.4920678436756134033203125, 0.59048140048980712890625, 0.639688193798065185546875);
    float lit = dot(n, l) - l.z;
    col += ((float3(1.0) * powr(fast::max(lit, 0.0), 1.5)) * 0.89999997615814208984375);
    col *= (1.0 + (fast::min(lit, 0.0) * 0.60000002384185791015625));
    fragColor = float4(fast::clamp(col, float3(0.0), float3(1.0)), pic.w);
}

fragment flair_pond_ripples_frag_out flair_pond_ripples_frag(constant FlairUniforms& _128 [[buffer(0)]], texture2d<float> uImage [[texture(1)]], sampler uImageSmplr [[sampler(1)]], float4 gl_FragCoord [[position]])
{
    flair_pond_ripples_frag_out out = {};
    float4 flair_color = float4(0.0, 0.0, 0.0, 1.0);
    float _748;
    if (_128.flair_flipY > 0.5)
    {
        _748 = _128.iResolution[1u] - gl_FragCoord.y;
    }
    else
    {
        _748 = gl_FragCoord.y;
    }
    float2 flair_coord = float2(gl_FragCoord.x, _748);
    float2 param_1 = flair_coord;
    float4 param;
    mainImage(param, param_1, _128, uImage, uImageSmplr);
    flair_color = param;
    out.flair_FragColor = flair_color;
    return out;
}

